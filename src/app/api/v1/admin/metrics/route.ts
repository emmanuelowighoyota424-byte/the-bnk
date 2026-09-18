import prisma from '@/lib/prisma';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';
import { hasPermission } from '@/lib/permissions';
import { getCurrentAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return unauthorizedResponse();
    if (!hasPermission(admin.role.permissions as string[], 'metrics.read')) return forbiddenResponse();
    const [totalUsers,activeUsers,totalAccounts,totalBalance,pendingKyc,todayTxs,openDisputes,openAlerts] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status:'active' } }),
      prisma.account.count(),
      prisma.account.aggregate({ _sum: { balance: true } }),
      prisma.kYCDocument.count({ where: { verificationStatus:'pending' } }),
      prisma.transaction.count({ where: { createdAt: { gte: new Date(Date.now()-24*60*60*1000) } } }),
      prisma.dispute.count({ where: { status: { not:'closed' } } }),
      prisma.fraudAlert.count({ where: { status:'open' } }),
    ]);
    return successResponse({
      users:{total:totalUsers,active:activeUsers},
      accounts:{total:totalAccounts,totalBalance:totalBalance._sum.balance||0},
      kyc:{pending:pendingKyc},
      transactions:{today:todayTxs},
      disputes:{open:openDisputes},
      fraud:{openAlerts},
    });
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}
