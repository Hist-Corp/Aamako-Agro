const path = 'C:/Users/poude/Desktop/Aamako Agro/Backend/';
require(path + 'node_modules/dotenv').config({ path: path + '.env' });
const { PrismaClient, Role } = require(path + 'node_modules/@prisma/client');
const bcrypt = require(path + 'node_modules/bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const accounts = [
    // Second-level admin (distinct from Super Admin)
    { email: 'admin2@aamako.agro', password: 'Admin456!', firstName: 'Asha', lastName: 'Admin', role: Role.STAFF_ADMIN },
    { email: 'manager@aamako.agro', password: 'Manager123!', firstName: 'Mina', lastName: 'Manager', role: Role.STAFF_MANAGER },
    { email: 'retail@aamako.agro', password: 'Retail123!', firstName: 'Ravi', lastName: 'Retail', role: Role.RETAIL_CUSTOMER },
    { email: 'wholesale@aamako.agro', password: 'Wholesale123!', firstName: 'Wina', lastName: 'Wholesale', role: Role.WHOLESALE_CUSTOMER },
  ];
  for (const a of accounts) {
    await prisma.user.upsert({
      where: { email: a.email },
      update: { passwordHash: bcrypt.hashSync(a.password, 12) },
      create: {
        email: a.email,
        passwordHash: await bcrypt.hash(a.password, 12),
        firstName: a.firstName,
        lastName: a.lastName,
        role: a.role,
      },
    });
    console.log('ready:', a.email);
  }
}
main().finally(() => prisma.$disconnect());
