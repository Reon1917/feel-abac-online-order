import { db } from "@/src/db/client";
import { admins, users } from "@/src/db/schema";
import { eq } from "drizzle-orm";

type AdminRole = "super_admin" | "admin" | "moderator";

async function seedModerator() {
  // Get email from command line args or environment variable
  const email = process.argv[2] || process.env.MODERATOR_EMAIL;
  const role: AdminRole = (process.argv[3] as AdminRole) || "moderator";

  if (!email) {
    console.log("Usage: npx tsx scripts/seed-moderator.ts <email> [role]");
    console.log("");
    console.log("Arguments:");
    console.log("  email  - Email address of the user to make a moderator");
    console.log("  role   - Optional: 'moderator' (default), 'admin', or 'super_admin'");
    console.log("");
    console.log("Examples:");
    console.log("  npx tsx scripts/seed-moderator.ts staff@example.com");
    console.log("  npx tsx scripts/seed-moderator.ts manager@example.com admin");
    console.log("");
    console.log("Or set MODERATOR_EMAIL environment variable:");
    console.log("  MODERATOR_EMAIL=staff@example.com npx tsx scripts/seed-moderator.ts");
    process.exit(1);
  }

  const validRoles: AdminRole[] = ["super_admin", "admin", "moderator"];
  if (!validRoles.includes(role)) {
    console.error(`❌ Invalid role: ${role}`);
    console.log("Valid roles: moderator, admin, super_admin");
    process.exit(1);
  }

  console.log(`🔍 Looking for user with email: ${email}`);

  // Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    console.log("\n📝 Steps to create this user:");
    console.log(`1. Have the user sign up at your app with: ${email}`);
    console.log("2. Complete onboarding (enter phone number)");
    console.log("3. Run this script again");
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.name} (${user.email})`);

  // Check if already admin
  const [existingAdmin] = await db
    .select()
    .from(admins)
    .where(eq(admins.userId, user.id))
    .limit(1);

  if (existingAdmin) {
    if (existingAdmin.role === role) {
      console.log(`⚠️  User already has role: ${existingAdmin.role}`);
      console.log(`   Active: ${existingAdmin.isActive}`);
      process.exit(0);
    }

    // Update existing role
    await db
      .update(admins)
      .set({ role, updatedAt: new Date() })
      .where(eq(admins.userId, user.id));

    console.log(`✅ Role updated: ${existingAdmin.role} → ${role}`);
    process.exit(0);
  }

  // Insert new admin record
  await db.insert(admins).values({
    id: crypto.randomUUID(),
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
  });

  const roleDescriptions = {
    moderator: "Order management, shop toggle, item stock control",
    admin: "Full admin access except team management",
    super_admin: "Full access including team management",
  };

  console.log(`✅ ${role.replace("_", " ")} created successfully!`);
  console.log(`   Email: ${email}`);
  console.log(`   Role: ${role}`);
  console.log(`   Permissions: ${roleDescriptions[role]}`);
  console.log(`\n🎉 ${user.name} can now log in and access the admin panel`);
}

seedModerator().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
