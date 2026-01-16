import { NextResponse } from "next/server";
import { and, lt, eq, inArray } from "drizzle-orm";
import { UTApi } from "uploadthing/server";

import { db } from "@/src/db/client";
import { orders, orderPayments } from "@/src/db/schema";
import { sendTransactionalEmail } from "@/lib/email/brevo";

const RETENTION_DAYS = 7;
const ORDER_LIMIT = 300;
const UPLOADTHING_BATCH_SIZE = 50;

// Set this to receive cleanup reports (or use env var)
const CLEANUP_NOTIFY_EMAIL = process.env.CLEANUP_NOTIFY_EMAIL;

/**
 * Extract UploadThing file key from URL.
 * UploadThing URLs are typically: https://utfs.io/f/{fileKey}
 */
function extractUploadThingKey(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // UploadThing URLs: /f/{fileKey}
    const match = parsed.pathname.match(/\/f\/(.+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  // Verify Vercel cron secret - fail closed in production
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (!cronSecret) {
    if (isProduction) {
      console.error("[cleanup-orders] CRON_SECRET is not set in production - blocking request");
      return NextResponse.json(
        { error: "Server misconfiguration: CRON_SECRET not set" },
        { status: 500 }
      );
    }
    // Dev/local: allow but warn
    console.warn("[cleanup-orders] CRON_SECRET not set - allowing request in development");
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  try {
    // Step 1: Get closed orders older than retention period (with limit)
    const oldOrders = await db
      .select({ id: orders.id, displayId: orders.displayId })
      .from(orders)
      .where(
        and(
          lt(orders.createdAt, cutoffDate),
          eq(orders.isClosed, true)
        )
      )
      .limit(ORDER_LIMIT);

    if (oldOrders.length === 0) {
      // Send "nothing to clean" notification
      if (CLEANUP_NOTIFY_EMAIL) {
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

    const receiptKeys = payments
      .map((p) => extractUploadThingKey(p.receiptUrl))
      .filter((key): key is string => key !== null);

    // Step 3: Delete from UploadThing first (before DB delete)
    // Process in batches to avoid timeout
    let receiptsDeleted = 0;
    if (receiptKeys.length > 0) {
      const utapi = new UTApi();
      
      for (let i = 0; i < receiptKeys.length; i += UPLOADTHING_BATCH_SIZE) {
        const batch = receiptKeys.slice(i, i + UPLOADTHING_BATCH_SIZE);
        try {
          await utapi.deleteFiles(batch);
          receiptsDeleted += batch.length;
        } catch (error) {
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

    const durationMs = Date.now() - startTime;
    const remainingInQueue = oldOrders.length === ORDER_LIMIT;

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
    console.error("[cleanup-orders] Cleanup failed:", error);
    
    // Send error notification
    if (CLEANUP_NOTIFY_EMAIL) {
      const timestamp = new Date().toLocaleString("en-GB", { timeZone: "Asia/Bangkok" });
      await sendTransactionalEmail({
        to: CLEANUP_NOTIFY_EMAIL,
        subject: `[Feel ABAC] Cleanup FAILED`,
        html: `
          <h2 style="color: red;">Order Cleanup Failed</h2>
          <p><strong>Time:</strong> ${timestamp} (Bangkok)</p>
          <p><strong>Error:</strong> ${error instanceof Error ? error.message : "Unknown error"}</p>
        `,
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
