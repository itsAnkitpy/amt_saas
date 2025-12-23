import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
    // ============================================
    // SUPERADMIN SETUP
    // ============================================
    // 
    // Replace 'YOUR_CLERK_USER_ID' with your actual Clerk User ID
    // Find it at: Clerk Dashboard → Users → Click your user → Copy User ID
    // Example: user_37CRe0RaAznrOUiYG8Al6snR5ua
    //
    const SUPERADMIN_CLERK_ID = process.env.SUPERADMIN_CLERK_ID || "YOUR_CLERK_USER_ID";
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "admin@amt.com";

    if (SUPERADMIN_CLERK_ID === "YOUR_CLERK_USER_ID") {
        console.error("❌ Please set SUPERADMIN_CLERK_ID in .env file");
        console.log("   1. Go to Clerk Dashboard → Users");
        console.log("   2. Click your user → Copy User ID");
        console.log("   3. Add to .env: SUPERADMIN_CLERK_ID=user_xxxxx");
        process.exit(1);
    }

    // Check if superadmin already exists
    const existingSuperAdmin = await prisma.user.findFirst({
        where: { isSuperAdmin: true },
    });

    if (existingSuperAdmin) {
        console.log("✅ Superadmin already exists:", existingSuperAdmin.email);
        return;
    }

    // Create superadmin user
    const superAdmin = await prisma.user.upsert({
        where: { id: SUPERADMIN_CLERK_ID },
        update: {
            isSuperAdmin: true,
            tenantId: null, // Superadmin has no tenant
            role: "SUPER_ADMIN",
        },
        create: {
            id: SUPERADMIN_CLERK_ID,
            email: SUPERADMIN_EMAIL,
            firstName: "Super",
            lastName: "Admin",
            role: "SUPER_ADMIN",
            isSuperAdmin: true,
            tenantId: null, // Superadmin has no tenant
        },
    });

    console.log("✅ Superadmin created:", superAdmin.email);
}

main()
    .catch((e) => {
        console.error("Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
