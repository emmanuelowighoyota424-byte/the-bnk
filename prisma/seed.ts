import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ROLES = [
  { name: 'Super Admin', description: 'Full system access with all permissions', permissions: ['users.read','users.write','users.suspend','kyc.review','kyc.approve','kyc.reject','transactions.read','transactions.adjust','cards.read','cards.manage','disputes.read','disputes.manage','disputes.resolve','fraud.alerts.read','fraud.alerts.manage','fraud.rules.manage','compliance.sar','compliance.aml','roles.read','roles.write','admins.read','admins.write','metrics.read','audit.read','communications.send','system.config'] },
  { name: 'Support Agent', description: 'Customer support with limited write access', permissions: ['users.read','users.suspend','transactions.read','cards.read','disputes.read','disputes.manage'] },
  { name: 'Compliance Officer', description: 'KYC review, compliance reporting, and regulatory filings', permissions: ['users.read','users.write','kyc.review','kyc.approve','kyc.reject','transactions.read','compliance.sar','compliance.aml','audit.read'] },
  { name: 'Risk Analyst', description: 'Fraud detection, investigation, and rule management', permissions: ['users.read','transactions.read','fraud.alerts.read','fraud.alerts.manage','fraud.rules.manage','audit.read','metrics.read'] },
];

async function main() {
  console.log('Seeding The Bnk database...');
  for (const roleData of DEFAULT_ROLES) {
    await prisma.role.upsert({ where: { name: roleData.name }, update: { permissions: roleData.permissions }, create: { name: roleData.name, description: roleData.description, permissions: roleData.permissions } });
  }
  console.log('Roles seeded');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@thebnk.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'Super Admin' } });
  if (superAdminRole) {
    await prisma.adminUser.upsert({ where: { email: adminEmail }, update: {}, create: { email: adminEmail, passwordHash, displayName: 'Super Admin', roleId: superAdminRole.id } });
    console.log('Admin user seeded: ' + adminEmail);
  }
  const testPasswordHash = await bcrypt.hash('Test@123!', 12);
  await prisma.user.upsert({ where: { email: 'test@thebnk.com' }, update: {}, create: { email: 'test@thebnk.com', passwordHash: testPasswordHash, bnkTag: 'testuser', firstName: 'Test', lastName: 'User', kycStatus: 'verified', kycTier: 1, status: 'active' } });
  console.log('Test user seeded: test@thebnk.com / Test@123!');
  console.log('Seeding complete!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });