import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import {
  uploadMenuImage,
  deleteMenuImageByKey,
  parseMenuImageKey,
} from "@/lib/menu/image-storage";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_MENU_IMAGE_BYTES,
} from "@/lib/menu/validators";
import { db } from "@/src/db/client";
import { menuItems } from "@/src/db/schema";

export const revalidate = 0;

export async function POST(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();
  const menuItemId = formData.get("menuItemId");
  const file = formData.get("file");

  if (typeof menuItemId !== "string" || !menuItemId) {
    return Response.json(
      { error: "menuItemId is required" },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    return Response.json({ error: "Image file is required" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return Response.json(
      {
        error: "Unsupported file type. Please upload JPEG, PNG, or WebP images.",
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_MENU_IMAGE_BYTES) {
    return Response.json(
      {
        error: `Image is too large. Max size is ${Math.round(
          MAX_MENU_IMAGE_BYTES / (1024 * 1024)
        )}MB.`,
      },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.id, menuItemId))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Menu item not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { url, key } = await uploadMenuImage(menuItemId, buffer);

  const [item] = await db
    .update(menuItems)
    .set({
      imageUrl: url,
      hasImage: true,
      updatedAt: new Date(),
    })
    .where(eq(menuItems.id, menuItemId))
    .returning();

  if (!item) {
    // Roll back upload if DB update fails
    await deleteMenuImageByKey(key).catch(() => undefined);
    return Response.json(
      { error: "Failed to update menu item with new image" },
      { status: 500 }
    );
  }

  const previousKey = parseMenuImageKey(existing.imageUrl);
  if (previousKey) {
    await deleteMenuImageByKey(previousKey).catch(() => undefined);
  }

  return Response.json({ imageUrl: url });
}

export async function DELETE(request: NextRequest) {
  const session = await requireActiveAdmin();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const menuItemId = searchParams.get("menuItemId");

  if (!menuItemId) {
    return Response.json(
      { error: "menuItemId query parameter is required" },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.id, menuItemId))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Menu item not found" }, { status: 404 });
  }

  const imageKey = parseMenuImageKey(existing.imageUrl);
  if (imageKey) {
    await deleteMenuImageByKey(imageKey).catch(() => undefined);
  }

  await db
    .update(menuItems)
    .set({
      imageUrl: null,
      hasImage: false,
      updatedAt: new Date(),
    })
    .where(eq(menuItems.id, menuItemId));

  return Response.json({ success: true });
}
