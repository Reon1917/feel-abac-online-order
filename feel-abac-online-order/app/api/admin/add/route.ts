import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/api/admin-guard";
import { db } from "@/src/db/client";
import { admins, users } from "@/src/db/schema";

const addAdminSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["super_admin", "admin", "moderator"]).default("admin"),
});

export async function POST(request: NextRequest) {
  const result = await requireSuperAdmin();
  if (!result) {
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

  const { email, role } = parsed.data;

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
      { error: `${user.name} (${email}) is already an admin with role: ${existingAdmin.role}` },
      { status: 400 }
    );
  }

  // Create admin with specified role
  await db.insert(admins).values({
    id: crypto.randomUUID(),
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
  });

  const roleLabel = role === "moderator" ? "moderator" : role === "admin" ? "admin" : "super admin";

  return Response.json({
    success: true,
    message: `✅ ${user.name} is now a ${roleLabel}! They can access the admin dashboard.`,
  });
}
