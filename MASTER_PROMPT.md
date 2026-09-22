# Crestline Capital — Full Platform Build (Customer + Admin)

Version: 1.0

Preservation directive: Preserve the existing the-bnk Next.js + Prisma/PostgreSQL application and progressively implement the Crestline Master Specification without replacing the working application with a greenfield microservice rewrite.

## Governing rules

- Preserve existing working functionality unless a change is required for the specification or security.
- Do not invent features outside the specification.
- Regulated capabilities — deposit-taking, withdrawals/money movement, yield/ROI plans, copy trading, crypto custody/trading, loans, and grants — are disabled by default and require recorded legal/compliance clearance before activation.
- Never store raw PANs, CVVs, plaintext passwords, production secrets, or master keys in source control.
- Every admin mutation must record actor, IP, user agent, and before/after JSON in the audit log.
- Financial records and audit records are append-only; corrections use reversal/correction records.
- New entities use UUIDs. Monetary calculations never use floating-point arithmetic.
- Write unit/integration/security tests as modules are implemented.
- Prefer the existing repository architecture when it can safely satisfy the requirement; introduce a service only when necessary.

## Existing architecture

- Customer: existing Next.js App Router at / and /dashboard.
- Admin: existing /admin and /admin?id=X query-param routing.
- Database: PostgreSQL through Prisma.
- Customer and admin authentication remain separate.
- Admin authentication uses a 48-character hexadecimal master key, hashed at rest and rate limited.
- Financial operations use PostgreSQL transactions, idempotency and locking.
- Future services are extracted incrementally; no forced greenfield migration.

## Design tokens

Use the specified Crestline dark-mode tokens: #0b0f19 base, #161e2e surface, #3b82f6 primary, #f8fafc primary text, #94a3b8 secondary text, #ef4444 error, #22c55e success, #f59e0b warning; Inter/system typography; 8/16/24/32px spacing; 8px cards, 6px buttons/inputs; 280px admin drawer; 64px top bar. Maintain WCAG 2.1 AA, keyboard navigation and accessible labels.

## Customer requirements

Public pages: /, /about, /grants, /login, /register.
Authenticated pages: /dashboard, accounts, transfers, cards, savings/investments, loans/credit, KYC and TOTP/SMS 2FA.
Regulated capabilities remain disabled until explicitly cleared.

## Admin requirements

Use /admin?id=X. Required IDs: Overview; 0 Deposits; 1 Withdrawals; 2 Users; 10 KYC; 11 Leads; 12 Tasks; 13 Referrals; 14 Import; 15 Transfers; 16 Payment Methods; 17 Cards; 18 Card Setup; 19 Currencies; 20 Loans; 21 Grants; 22 IRS; 23 Membership; 24 Plans; 25 Crypto; 26 Signals; 27 Providers; 28 Copy Trading; 29 Courses; 30 Inbox; 31 Tickets; 32 Live Chat; 33 Broadcast; 34 Contact; 35 Agents; 36 Testimonials; 37 Appearance; 38 Themes; 39 Assets; 40 Content; 41 FAQ; 42 Audit Log; 43 Settings; /admin/login.

RBAC: SUPER_ADMIN all permitted capabilities; ADMIN users/KYC/deposits/withdrawals/signals/audit/impersonation; COMPLIANCE KYC/users/audit; FINANCE deposits/withdrawals/audit; SUPPORT user viewing only. Enforce RBAC server-side.

## Security

TLS/HSTS in deployment. Use an OWASP-compliant password hashing scheme while preserving safe compatibility with existing customer hashes. Admin master key is exactly 48 hexadecimal characters, verified safely, hashed at rest, with maximum 5 failed attempts per 15 minutes and lockout/alert behavior. Admin cookies/sessions are separate from customer sessions and never stored in localStorage. Never store raw PAN/CVV. Sensitive data is encrypted at rest where applicable. Secrets belong in deployment secret storage. Structured API errors must not leak stack traces.

## Audit

Every admin mutation records actor, action, entity type/id, IP, user agent, before JSON, after JSON and timestamp. Application code must not expose update/delete paths for audit records.

## Compliance feature flags

Default all to false:
- FEATURE_DEPOSITS_ENABLED=false
- FEATURE_WITHDRAWALS_ENABLED=false
- FEATURE_LOANS_ENABLED=false
- FEATURE_GRANTS_ENABLED=false
- FEATURE_YIELD_ENABLED=false
- FEATURE_COPY_TRADING_ENABLED=false
- FEATURE_CRYPTO_ENABLED=false

Admin Settings must expose Regulatory Mode. Enabling regulated capabilities requires explicit operator action and recorded compliance clearance. Do not claim Crestline is a regulated bank, licensed financial institution or tax authority. The IRS module is configuration/content only unless separately and lawfully integrated. Maintain docs/compliance.md for US, UK, EU, Australia and Canada review requirements.

## Testing and delivery

Required as applicable: unit tests, PostgreSQL integration tests, security tests, Playwright E2E, load tests for critical dashboard/admin paths, and dependency/security scanning in CI. A module is not complete merely because its UI renders.

Delivery order: preserve/document existing app; harden database/security; complete customer registration/login; complete admin auth/RBAC/audit; complete Overview/Users/KYC/Deposits/Withdrawals/Audit; implement remaining admin modules respecting feature gates; harden customer workflows; add OpenAPI; add extraction-ready boundaries; add infrastructure/observability/testing/runbooks.

## Stop conditions

Ask before enabling a regulated feature without written clearance, storing raw card data, weakening audit immutability, making a materially different architectural choice, exposing admin functionality without required access controls, or introducing an unapproved third-party PII/money-processing dependency.

Every AI coding agent working on this repository must read MASTER_PROMPT.md before making changes.
