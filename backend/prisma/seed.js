require("dotenv").config();
const bcrypt = require("bcrypt");
const prisma = require("../src/config/db-config");

const PLATFORMS = {
  facebook: [
    "account_info",
    "posts",
    "messages",
    "timeline",
    "friends",
    "followers",
    "following",
  ],
  twitter: [
    "account_info",
    "posts",
    "messages",
    "timeline",
    "followers",
    "following",
  ],
  instagram: ["account_info", "posts", "messages", "followers", "following"],
  telegram: ["account_info", "messages", "friends"],
  whatsapp: ["account_info", "messages", "friends"],
  google: ["account_info", "timeline", "friends"],
};

async function main() {
  for (const [name, sections] of Object.entries(PLATFORMS)) {
    const platform = await prisma.platform.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    for (const sectionName of sections) {
      await prisma.platformSection.upsert({
        where: {
          platformId_sectionName: { platformId: platform.id, sectionName },
        },
        update: {},
        create: { platformId: platform.id, sectionName },
      });
    }
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    if (Buffer.byteLength(password, "utf8") > 72) {
      throw new Error("SEED_ADMIN_PASSWORD must be at most 72 bytes.");
    }
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        fullName: "System Admin",
        role: "admin",
      },
    });
  } else {
    console.warn(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set - skipped admin user",
    );
  }
  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
