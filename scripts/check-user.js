const path = 'C:/Users/poude/Desktop/Aamako Agro/Backend/';
require(path + 'node_modules/dotenv').config({ path: path + '.env' });
const { PrismaClient } = require(path + 'node_modules/@prisma/client');
const bcrypt = require(path + 'node_modules/bcryptjs');
const p = new PrismaClient();
p.user.findUnique({ where: { email: 'admin2@aamako.agro' } })
  .then(async (u) => {
    if (!u) return console.log('USER NOT FOUND');
    console.log(JSON.stringify({ email: u.email, role: u.role, isActive: u.isActive }));
    console.log('bcrypt compare:', await bcrypt.compare('Admin456!', u.passwordHash));
  })
  .finally(() => p.$disconnect());
