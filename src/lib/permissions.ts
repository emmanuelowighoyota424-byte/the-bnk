export type Permission =
  | 'users.read' | 'users.write' | 'users.suspend'
  | 'kyc.review' | 'kyc.approve' | 'kyc.reject'
  | 'transactions.read' | 'transactions.adjust'\n  | 'withdrawals.manage' | 'deposits.manage'
  | 'cards.read' | 'cards.manage'
  | 'disputes.read' | 'disputes.manage' | 'disputes.resolve'
  | 'fraud.alerts.read' | 'fraud.alerts.manage' | 'fraud.rules.manage'
  | 'compliance.sar' | 'compliance.aml'
  | 'roles.read' | 'roles.write'
  | 'admins.read' | 'admins.write'
  | 'metrics.read'
  | 'audit.read'
  | 'communications.send'
  | 'system.config';

export function hasPermission(userPermissions: string[], required: Permission): boolean {
  if (userPermissions.includes('system.config')) return true;
  return userPermissions.includes(required);
}

export function hasAnyPermission(userPermissions: string[], required: Permission[]): boolean {
  if (userPermissions.includes('system.config')) return true;
  return required.some((p) => userPermissions.includes(p));
}

export function hasAllPermissions(userPermissions: string[], required: Permission[]): boolean {
  if (userPermissions.includes('system.config')) return true;
  return required.every((p) => userPermissions.includes(p));
}