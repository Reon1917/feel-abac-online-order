import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireActiveAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { admins, users } from "@/src/db/schema";

const addAdminSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export async function POST(request: NextRequest) {
  // Security: Only super_admin can add admins
  const sessionData = await requireActiveAdmin();

  if (!sessionData?.session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [currentAdmin] = await db
    .select()
    .from(admins)
    .where(eq(admins.userId, sessionData.session.user.id))
    .limit(1);

  if (!currentAdmin || currentAdmin.role !== "super_admin") {
    return Response.json(
      { error: "Only super admins can add other admins" },
      { status: 403 }
    );
  }

  // Validate input
  const body = await request.json();
  const parsed = addAdminSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Check if user exists
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return Response.json(
      {
        error: `No account found for ${email}. Ask them to sign up first at your app, then try again.`,
        userExists: false,
      },
      { status: 404 }
    );
  }

  // Check if already admin
  const [existingAdmin] = await db
    .select()
    .from(admins)
    .where(eq(admins.userId, user.id))
    .limit(1);

  if (existingAdmin) {
    return Response.json(
      { error: `${user.name} (${email}) is already a super admin!` },
      { status: 400 }
    );
  }

  // Create admin with super_admin role
  await db.insert(admins).values({
    id: crypto.randomUUID(),
    userId: user.id,
    email: user.email,
    name: user.name,
    role: "super_admin",
  });

  return Response.json({
    success: true,
    message: `✅ ${user.name} is now a super admin! They can manage admins and access the dashboard.`,
  });
}

