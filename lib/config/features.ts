export const FEATURE_FLAGS = {
  deposits: process.env.FEATURE_DEPOSITS_ENABLED === 'true',
  withdrawals: process.env.FEATURE_WITHDRAWALS_ENABLED === 'true',
  loans: process.env.FEATURE_LOANS_ENABLED === 'true',
  grants: process.env.FEATURE_GRANTS_ENABLED === 'true',
  yield: process.env.FEATURE_YIELD_ENABLED === 'true',
  copyTrading: process.env.FEATURE_COPY_TRADING_ENABLED === 'true',
  crypto: process.env.FEATURE_CRYPTO_ENABLED === 'true',
} as const

export function requireFeature(enabled: boolean, name: string) {
  if (!enabled) throw new Error('FEATURE_DISABLED:' + name)
}
