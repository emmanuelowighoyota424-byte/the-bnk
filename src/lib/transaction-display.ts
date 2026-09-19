const CREDIT_TYPES = new Set(['DEPOSIT', 'CREDIT', 'TRANSFER_IN', 'INTEREST', 'REFUND']);
const DEBIT_TYPES = new Set(['WITHDRAWAL', 'DEBIT', 'TRANSFER_OUT', 'PAYMENT', 'FEE']);

/**
 * Financial amounts are stored as positive magnitudes. Direction comes from
 * the transaction type rather than from a client-side sign convention.
 */
export function isCreditTransaction(txType: string) {
  const normalized = txType.trim().toUpperCase();
  if (CREDIT_TYPES.has(normalized)) return true;
  if (DEBIT_TYPES.has(normalized)) return false;
  return false;
}

export function signedTransactionAmount(amount: number | string, txType: string) {
  const value = Math.abs(Number(amount || 0));
  return isCreditTransaction(txType) ? value : -value;
}
