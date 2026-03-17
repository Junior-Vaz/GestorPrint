const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const count = await prisma.transaction.count();
    console.log(`Transaction table found. Count: ${count}`);
    process.exit(0);
  } catch (e) {
    console.error('Error checking Transaction table:', e.message);
    process.exit(1);
  }
}

check();
