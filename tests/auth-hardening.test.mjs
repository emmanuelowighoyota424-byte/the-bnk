import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('production build does not suppress TypeScript errors', () => {
  assert.doesNotMatch(read('next.config.js'), /ignoreBuildErrors/)
})

test('TOTP verification does not trust caller supplied userId', () => {
  const source = read('src/app/api/v1/auth/2fa/verify-totp/route.ts')
  assert.doesNotMatch(source, /headers\.get\(['"]x-user-id['"]\)/)
  assert.match(source, /challengeId/)
  assert.match(source, /LOGIN_2FA/)
})

test('login creates a server-bound 2FA challenge before session issuance', () => {
  const source = read('src/app/api/v1/auth/login/route.ts')
  assert.match(source, /createAuthChallenge/)
  assert.match(source, /requiresTotp/)
  assert.doesNotMatch(source, /tempToken/)
})

test('refresh tokens are stored hashed', () => {
  const source = read('src/lib/auth.ts')
  assert.match(source, /hashToken\(refreshToken\)/)
  assert.match(source, /lastActivityAt/)
})

test('password policy is enforced server-side', () => {
  const source = read('lib/auth/password-utils.ts')
  assert.match(source, /password\.length < 12/)
  assert.match(source, /bcrypt/)
  assert.match(source, /verifyAndUpgradePassword/)
})

test('password reset is challenge-bound and session revoking', () => {
  const source = read('app/api/auth/route.ts')
  assert.match(source, /PASSWORD_RESET/)
  assert.match(source, /challengeId/)
  assert.match(source, /userSession\.updateMany/)
  assert.doesNotMatch(source, /body\.userId/)
})
