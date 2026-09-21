import type { AdminUser, Role } from '@prisma/client'
import { requireAdmin } from '@/lib/auth/admin'

export const ADMIN_CAPABILITIES = {
  viewUsers: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'SUPPORT'],
  kyc: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'],
  deposits: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'],
  withdrawals: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'],
  signals: ['SUPER_ADMIN', 'ADMIN'],
  audit: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'FINANCE'],
  impersonation: ['SUPER_ADMIN', 'ADMIN'],
} as const

type AdminWithRole = AdminUser & { role: Role }

export async function requireAdminCapability(
  capability: keyof typeof ADMIN_CAPABILITIES,
): Promise<AdminWithRole | null> {
  const admin = await requireAdmin()
  if (!admin) return null
  return (ADMIN_CAPABILITIES[capability] as readonly string[]).includes(admin.role.name) ? admin : null
}
