import { NextResponse } from "next/server";
import { lt, inArray } from "drizzle-orm";
import { UTApi } from "uploadthing/server";

import { db } from "@/src/db/client";
import { orders, orderPayments } from "@/src/db/schema";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { escapeHtml } from "@/lib/email/templates/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RETENTION_DAYS = 7;
const ORDER_LIMIT = 50;
const UPLOADTHING_BATCH_SIZE = 50;

// Set this to receive cleanup reports (or use env var)
const CLEANUP_NOTIFY_EMAIL = process.env.CLEANUP_NOTIFY_EMAIL;

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function appendRunLog(
  runLogs: string[],
  message: string,
  meta?: Record<string, unknown>
) {
  const timestamp = new Date().toISOString();
  const metaSuffix =
    meta && Object.keys(meta).length > 0 ? ` ${safeStringify(meta)}` : "";
  runLogs.push(`[${timestamp}] ${message}${metaSuffix}`);
  // Keep at most 250 log lines in memory; bump the numeric cap below if needed.
  // Older entries are dropped first to prevent unbounded growth on long runs.
  if (runLogs.length > 250) {
    runLogs.shift();
  }
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message || "Unknown error",
      stack: error.stack ?? null,
    };
  }
  if (typeof error === "string") {
    return { message: error, stack: null };
  }
  return {
    message: "Non-Error exception",
    stack: safeStringify(error),
  };
}

async function sendCleanupFailureEmail(input: {
  phase: string;
  reason: string;
  errorStack?: string | null;
  context?: Record<string, unknown>;
  runLogs?: string[];
  durationMs?: number;
}) {
  if (!CLEANUP_NOTIFY_EMAIL) return;

  const timestamp = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
  });
  const contextBlock = input.context
    ? `<pre style="white-space: pre-wrap; background: #f8fafc; padding: 12px; border-radius: 8px;">${escapeHtml(
        safeStringify(input.context)
      )}</pre>`
    : "<p><em>No context provided.</em></p>";
  const logsBlock =
    input.runLogs && input.runLogs.length > 0
      ? `<pre style="white-space: pre-wrap; background: #f8fafc; padding: 12px; border-radius: 8px;">${escapeHtml(
          input.runLogs.join("\n")
        )}</pre>`
      : "<p><em>No execution logs captured.</em></p>";
  const stackBlock = input.errorStack
    ? `<pre style="white-space: pre-wrap; background: #fff1f2; padding: 12px; border-radius: 8px;">${escapeHtml(
        input.errorStack
      )}</pre>`
    : "<p><em>No stack trace available.</em></p>";

  await sendTransactionalEmail({
    to: CLEANUP_NOTIFY_EMAIL,
    subject: `[Feel ABAC] Cleanup FAILED (${input.phase})`,
    html: `
      <h2 style="color: #b91c1c;">Order Cleanup Failed</h2>
      <p><strong>Time:</strong> ${timestamp} (Bangkok)</p>
      <p><strong>Phase:</strong> ${escapeHtml(input.phase)}</p>
      <p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>
      ${
        typeof input.durationMs === "number"
          ? `<p><strong>Duration before failure:</strong> ${input.durationMs}ms</p>`
          : ""
      }
      <h3>Context</h3>
      ${contextBlock}
      <h3>Error Stack</h3>
      ${stackBlock}
      <h3>Execution Logs</h3>
      ${logsBlock}
    `,
  }).catch((emailError) => {
    console.error("[cleanup-orders] Failed to send failure email", emailError);
  });
}

/**
 * Extract UploadThing file key from URL.
 * Supports:
 * - https://utfs.io/f/{fileKey}
 * - https://uploadthing.com/f/{appId}/{fileKey}
 */
function extractUploadThingKey(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const fIndex = parts.indexOf("f");
    if (fIndex === -1) return null;
    const after = parts.slice(fIndex + 1);
    if (after.length === 0) return null;
    return after[after.length - 1] ?? null;
  } catch {
    const match = url.match(/\/f\/([^/?#]+)(?:[/?#]|$)/);
    return match?.[1] ?? null;
  }
}

export async function GET(request: Request) {
  // Verify Vercel cron secret - fail closed in production
  const startTime = Date.now();
  const runLogs: string[] = [];

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === "production";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const isVercelCronAgent = userAgent.startsWith("vercel-cron/");
  const source = isVercelCronAgent ? "vercel-cron" : "manual";

  appendRunLog(runLogs, "Cron trigger received", {
    source,
    hasAuthHeader: Boolean(authHeader),
    hasVercelCronHeader: Boolean(vercelCronHeader),
  });

  if (!cronSecret) {
    if (isProduction) {
      appendRunLog(runLogs, "Blocked: CRON_SECRET missing in production");
      console.error(
        "[cleanup-orders] CRON_SECRET is not set in production - blocking request",
        {
          isVercelCronAgent,
          hasVercelCronHeader: Boolean(vercelCronHeader),
        }
      );
      await sendCleanupFailureEmail({
        phase: "auth",
        reason: "CRON_SECRET is not set in production",
        context: {
          source,
          hasAuthHeader: Boolean(authHeader),
          hasVercelCronHeader: Boolean(vercelCronHeader),
          isProduction,
        },
        runLogs,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: "Server misconfiguration: CRON_SECRET not set" },
        { status: 500 }
      );
    }
    // Dev/local: allow but warn
    console.warn("[cleanup-orders] CRON_SECRET not set - allowing request in development");
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    appendRunLog(runLogs, "Blocked: Authorization header mismatch", {
      source,
      hasAuthHeader: Boolean(authHeader),
      hasVercelCronHeader: Boolean(vercelCronHeader),
    });
    console.warn("[cleanup-orders] Unauthorized trigger rejected", {
      hasAuthHeader: Boolean(authHeader),
      isVercelCronAgent,
      hasVercelCronHeader: Boolean(vercelCronHeader),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  appendRunLog(runLogs, "Trigger authenticated", {
    source,
    retentionDays: RETENTION_DAYS,
    orderLimit: ORDER_LIMIT,
    uploadthingBatchSize: UPLOADTHING_BATCH_SIZE,
  });
  console.log("[cleanup-orders] Trigger accepted", {
    source,
    hasVercelCronHeader: Boolean(vercelCronHeader),
    retentionDays: RETENTION_DAYS,
    orderLimit: ORDER_LIMIT,
    uploadthingBatchSize: UPLOADTHING_BATCH_SIZE,
  });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  appendRunLog(runLogs, "Computed cutoff date", {
    cutoffDateIso: cutoffDate.toISOString(),
  });

  try {
    // Step 1: Get orders older than retention period (with limit)
    const oldOrders = await db
      .select({ id: orders.id, displayId: orders.displayId })
      .from(orders)
      .where(
        lt(orders.createdAt, cutoffDate)
      )
      .limit(ORDER_LIMIT);
    appendRunLog(runLogs, "Fetched candidate orders", {
      count: oldOrders.length,
      limit: ORDER_LIMIT,
    });

    if (oldOrders.length === 0) {
      // Send "nothing to clean" notification
      if (CLEANUP_NOTIFY_EMAIL) {
        appendRunLog(runLogs, "No orders to clean; sending success email");
        const timestamp = new Date().toLocaleString("en-GB", { timeZone: "Asia/Bangkok" });
        await sendTransactionalEmail({
          to: CLEANUP_NOTIFY_EMAIL,
          subject: `[Feel ABAC] Cleanup ran - nothing to delete`,
          html: `
            <h2 style="color: green;">Order Cleanup Successful</h2>
            <p><strong>Time:</strong> ${timestamp} (Bangkok)</p>
            <p>No orders older than ${RETENTION_DAYS} days needed cleanup today.</p>
          `,
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        message: "No orders to clean up",
        ordersDeleted: 0,
        receiptsDeleted: 0,
        durationMs: Date.now() - startTime,
      });
    }

    const orderIds = oldOrders.map((o) => o.id);

    // Step 2: Get all receipt URLs for these orders
    const payments = await db
      .select({ receiptUrl: orderPayments.receiptUrl })
      .from(orderPayments)
      .where(inArray(orderPayments.orderId, orderIds));
    appendRunLog(runLogs, "Fetched payment receipts", {
      paymentRows: payments.length,
    });

    const receiptKeys = payments
      .map((p) => extractUploadThingKey(p.receiptUrl))
      .filter((key): key is string => key !== null);
    appendRunLog(runLogs, "Resolved receipt keys", {
      receiptKeyCount: receiptKeys.length,
    });

    // Step 3: Delete from UploadThing first (before DB delete)
    // Process in batches to avoid timeout
    let receiptsDeleted = 0;
    if (receiptKeys.length > 0) {
      const utapi = new UTApi();
      
      for (let i = 0; i < receiptKeys.length; i += UPLOADTHING_BATCH_SIZE) {
        const batchNumber = Math.floor(i / UPLOADTHING_BATCH_SIZE) + 1;
        const batch = receiptKeys.slice(i, i + UPLOADTHING_BATCH_SIZE);
        try {
          await utapi.deleteFiles(batch);
          receiptsDeleted += batch.length;
          appendRunLog(runLogs, "Deleted UploadThing batch", {
            batchNumber,
            batchSize: batch.length,
            receiptsDeletedSoFar: receiptsDeleted,
          });
        } catch (error) {
          appendRunLog(runLogs, "Failed UploadThing batch", {
            batchNumber,
            batchSize: batch.length,
            error: getErrorDetails(error).message,
          });
          // Log but continue - orphan files are acceptable
          console.error(
            `[cleanup-orders] Failed to delete UploadThing batch ${i / UPLOADTHING_BATCH_SIZE + 1}:`,
            error
          );
        }
      }
    }

    // Step 4: Delete orders from DB (cascade handles children)
    const deleted = await db
      .delete(orders)
      .where(inArray(orders.id, orderIds))
      .returning({ id: orders.id });
    appendRunLog(runLogs, "Deleted orders from database", {
      deletedOrders: deleted.length,
      candidateOrders: oldOrders.length,
    });

    const durationMs = Date.now() - startTime;
    const remainingInQueue = oldOrders.length === ORDER_LIMIT;
    appendRunLog(runLogs, "Cleanup completed", {
      deletedOrders: deleted.length,
      receiptsDeleted,
      remainingInQueue,
      durationMs,
    });

    console.log(
      `[cleanup-orders] Deleted ${deleted.length} orders, ${receiptsDeleted} receipts in ${durationMs}ms`
    );

    // Send email notification
    if (CLEANUP_NOTIFY_EMAIL) {
      const timestamp = new Date().toLocaleString("en-GB", { timeZone: "Asia/Bangkok" });
      await sendTransactionalEmail({
        to: CLEANUP_NOTIFY_EMAIL,
        subject: `[Feel ABAC] Cleanup: ${deleted.length} orders deleted`,
        html: `
          <h2>Order Cleanup Report</h2>
          <p><strong>Time:</strong> ${timestamp} (Bangkok)</p>
          <p><strong>Orders deleted:</strong> ${deleted.length}</p>
          <p><strong>Receipt files deleted:</strong> ${receiptsDeleted}</p>
          <p><strong>Duration:</strong> ${durationMs}ms</p>
          ${remainingInQueue ? '<p style="color: orange;"><strong>Note:</strong> More orders pending cleanup (hit limit). Will continue tomorrow.</p>' : ''}
        `,
      }).catch(() => {}); // Don't fail the cron if email fails
    }

    return NextResponse.json({
      success: true,
      ordersDeleted: deleted.length,
      receiptsDeleted,
      remainingInQueue,
      durationMs,
    });
  } catch (error) {
    const details = getErrorDetails(error);
    appendRunLog(runLogs, "Fatal cleanup failure", {
      message: details.message,
    });
    console.error("[cleanup-orders] Cleanup failed:", error);
    
    // Send error notification
    await sendCleanupFailureEmail({
      phase: "execution",
      reason: details.message,
      errorStack: details.stack,
      context: {
        source,
        hasVercelCronHeader: Boolean(vercelCronHeader),
        retentionDays: RETENTION_DAYS,
        orderLimit: ORDER_LIMIT,
        uploadthingBatchSize: UPLOADTHING_BATCH_SIZE,
      },
      runLogs,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: details.message,
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
