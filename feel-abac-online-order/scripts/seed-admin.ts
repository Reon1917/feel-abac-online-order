import { db } from "@/src/db/client";
import { admins, users } from "@/src/db/schema";
import { eq } from "drizzle-orm";

async function seedAdmin() {
  const email = "feelabac.admin@gmail.com";
  
  console.log(`🔍 Looking for user with email: ${email}`);
  
  // Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    console.error("❌ User not found. Please create account first:", email);
    console.log("\n📝 Steps to create admin:");
    console.log("1. Go to your app and sign up with:", email);
    console.log("2. Complete onboarding");
    console.log("3. Run this script again: npx tsx scripts/seed-admin.ts");
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
    console.log("⚠️  User is already an admin");
    console.log(`   Role: ${existingAdmin.role}`);
    console.log(`   Active: ${existingAdmin.isActive}`);
    process.exit(0);
  }

  // Insert admin
  await db.insert(admins).values({
    id: crypto.randomUUID(),
    userId: user.id,
    email: user.email,
    name: user.name,
    role: "super_admin",
  });

  console.log("✅ Admin created successfully!");
  console.log(`   Email: ${email}`);
  console.log(`   Role: super_admin`);
  console.log("\n🎉 You can now log in and access /admin/dashboard");
}

seedAdmin().catch((error) => {
  console.error("❌ Error seeding admin:", error);
  process.exit(1);
});

