import { NextResponse, type NextRequest } from "next/server";

import { getPusherServer } from "@/lib/pusher/server";
import { ADMIN_ORDERS_CHANNEL, parseOrderChannelName } from "@/lib/orders/events";
import { getOrderAccessInfo } from "@/lib/orders/queries";
import { resolveUserId } from "@/lib/api/require-user";
import { db } from "@/src/db/client";
import { admins } from "@/src/db/schema";
import { eq } from "drizzle-orm";

type AuthPayload = {
  socket_id?: string;
  socketId?: string;
  channel_name?: string;
  channelName?: string;
};

function extractBodyFields(body: AuthPayload | null) {
  if (!body) return { socketId: null, channelName: null };
  const socketId = body.socket_id ?? body.socketId ?? null;
  const channelName = body.channel_name ?? body.channelName ?? null;
  return { socketId, channelName };
}

async function parseRequest(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as AuthPayload | null;
    return extractBodyFields(body);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return { socketId: null, channelName: null };
  return {
    socketId: (form.get("socket_id") ?? form.get("socketId")) as string | null,
    channelName: (form.get("channel_name") ??
      form.get("channelName")) as string | null,
  };
}

export async function POST(req: NextRequest) {
  const { socketId, channelName } = await parseRequest(req);

  if (!socketId || !channelName) {
    return NextResponse.json(
      { error: "Missing socket_id or channel_name" },
      { status: 400 }
    );
  }

  const viewerUserId = await resolveUserId(req);

  if (!viewerUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminRow =
    (await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.userId, viewerUserId))
      .limit(1))[0] ?? null;

  const isAdmin = Boolean(adminRow);


  if (channelName === ADMIN_ORDERS_CHANNEL && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const displayId = parseOrderChannelName(channelName);
  if (displayId) {
    const accessInfo = await getOrderAccessInfo(displayId);
    if (!accessInfo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner =
      accessInfo.userId === null || accessInfo.userId === viewerUserId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const pusher = getPusherServer();
  const authResponse = pusher.authorizeChannel(socketId, channelName);

  return NextResponse.json(authResponse);
}
