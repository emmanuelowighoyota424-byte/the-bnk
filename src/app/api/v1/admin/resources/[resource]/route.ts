import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils';

const MAX_PAGE_SIZE = 100;

function pagination(req: NextRequest) {
  const rawPage = Number.parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const rawPageSize = Number.parseInt(req.nextUrl.searchParams.get('pageSize') || '25', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, MAX_PAGE_SIZE) : 25;
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function response<T>(rows: T[], total: number, page: number, pageSize: number) {
  return successResponse({
    rows,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { resource: string } }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorizedResponse();

  const resource = params.resource;
  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  const { page, pageSize, skip } = pagination(req);

  try {
    switch (resource) {
      case 'users': {
        const where = q ? { OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
          { bnkTag: { contains: q, mode: 'insensitive' as const } },
        ] } : undefined;
        const [rows, total] = await prisma.$transaction([
          prisma.user.findMany({ where, select: { id: true, email: true, firstName: true, lastName: true, bnkTag: true, kycStatus: true, kycTier: true, status: true, createdAt: true, _count: { select: { accounts: true } } }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
          prisma.user.count({ where }),
        ]);
        return response(rows, total, page, pageSize);
      }
      case 'kyc': {
        const where = q ? { OR: [
          { docType: { contains: q, mode: 'insensitive' as const } },
          { verificationStatus: { contains: q, mode: 'insensitive' as const } },
          { user: { email: { contains: q, mode: 'insensitive' as const } } },
        ] } : undefined;
        const [rows, total] = await prisma.$transaction([
          prisma.kYCDocument.findMany({ where, select: { id: true, docType: true, verificationStatus: true, reviewerId: true, reviewNotes: true, reviewedAt: true, createdAt: true, user: { select: { id: true, email: true, firstName: true, lastName: true, kycStatus: true } } }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
          prisma.kYCDocument.count({ where }),
        ]);
        return response(rows, total, page, pageSize);
      }
      case 'deposits': {
        const where = q ? { OR: [
          { reference: { contains: q, mode: 'insensitive' as const } },
          { status: { contains: q, mode: 'insensitive' as const } },
          { user: { email: { contains: q, mode: 'insensitive' as const } } },
        ] } : undefined;
        const [rows, total] = await prisma.$transaction([
          prisma.deposit.findMany({ where, select: { id: true, amount: true, currency: true, reference: true, status: true, description: true, createdAt: true, completedAt: true, user: { select: { id: true, email: true, firstName: true, lastName: true } }, account: { select: { id: true, accountNumber: true } } }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
          prisma.deposit.count({ where }),
        ]);
        return response(rows, total, page, pageSize);
      }
      case 'withdrawals': {
        const where = q ? { OR: [
          { reference: { contains: q, mode: 'insensitive' as const } },
          { status: { contains: q, mode: 'insensitive' as const } },
          { destination: { contains: q, mode: 'insensitive' as const } },
          { user: { email: { contains: q, mode: 'insensitive' as const } } },
        ] } : undefined;
        const [rows, total] = await prisma.$transaction([
          prisma.withdrawal.findMany({ where, select: { id: true, amount: true, currency: true, reference: true, status: true, destination: true, description: true, createdAt: true, reviewedAt: true, user: { select: { id: true, email: true, firstName: true, lastName: true } }, account: { select: { id: true, accountNumber: true } } }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
          prisma.withdrawal.count({ where }),
        ]);
        return response(rows, total, page, pageSize);
      }
      case 'cards': {
        const where = q ? { OR: [
          { lastFour: { contains: q } },
          { status: { contains: q, mode: 'insensitive' as const } },
          { user: { email: { contains: q, mode: 'insensitive' as const } } },
        ] } : undefined;
        const [rows, total] = await prisma.$transaction([
          prisma.card.findMany({ where, select: { id: true, cardType: true, cardNetwork: true, lastFour: true, status: true, isVirtual: true, spendingLimitDaily: true, spendingLimitMonthly: true, createdAt: true, user: { select: { id: true, email: true, firstName: true, lastName: true } }, account: { select: { accountNumber: true } } }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
          prisma.card.count({ where }),
        ]);
        return response(rows, total, page, pageSize);
      }
      case 'customers': {
        const where = q ? { OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
          { bnkTag: { contains: q, mode: 'insensitive' as const } },
        ] } : undefined;
        const [rows, total] = await prisma.$transaction([
          prisma.user.findMany({ where, select: { id: true, email: true, firstName: true, lastName: true, phone: true, bnkTag: true, kycStatus: true, kycTier: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
          prisma.user.count({ where }),
        ]);
        return response(rows, total, page, pageSize);
      }
      case 'accounts': {
        const where = q ? { OR: [
          { accountNumber: { contains: q } },
          { user: { email: { contains: q, mode: 'insensitive' as const } } },
        ] } : undefined;
        const [rows, total] = await prisma.$transaction([
          prisma.account.findMany({ where, select: { id: true, accountNumber: true, accountType: true, currency: true, balance: true, availableBalance: true, status: true, openedAt: true, user: { select: { id: true, email: true, firstName: true, lastName: true } } }, orderBy: { openedAt: 'desc' }, skip, take: pageSize }),
          prisma.account.count({ where }),
        ]);
        return response(rows, total, page, pageSize);
      }
      case 'transactions': {
        const where = q ? { OR: [
          { referenceId: { contains: q, mode: 'insensitive' as const } },
          { description: { contains: q, mode: 'insensitive' as const } },
          { user: { email: { contains: q, mode: 'insensitive' as const } } },
        ] } : undefined;
        const [rows, total] = await prisma.$transaction([
          prisma.transaction.findMany({ where, select: { id: true, txType: true, amount: true, currency: true, description: true, status: true, referenceId: true, journalId: true, createdAt: true, account: { select: { id: true, accountNumber: true } }, user: { select: { id: true, email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
          prisma.transaction.count({ where }),
        ]);
        return response(rows, total, page, pageSize);
      }
      case 'transfers': {
        const where = q ? { OR: [
          { reference: { contains: q, mode: 'insensitive' as const } },
          { senderUserId: { contains: q } },
          { recipientUserId: { contains: q } },
        ] } : undefined;
        const [rows, total] = await prisma.$transaction([
          prisma.transfer.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
          prisma.transfer.count({ where }),
        ]);
        return response(rows, total, page, pageSize);
      }
      case 'audit-logs': {
        const where = q ? { OR: [
          { action: { contains: q, mode: 'insensitive' as const } },
          { entityType: { contains: q, mode: 'insensitive' as const } },
          { entityId: { contains: q } },
        ] } : undefined;
        const [rows, total] = await prisma.$transaction([
          prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
          prisma.auditLog.count({ where }),
        ]);
        return response(rows, total, page, pageSize);
      }
      default:
        return errorResponse('Unsupported admin resource', 404);
    }
  } catch (error) {
    console.error(error);
    return errorResponse('Unable to load admin resource', 500);
  }
}
