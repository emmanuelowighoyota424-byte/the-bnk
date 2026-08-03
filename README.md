# The Bnk — Digital Banking Ecosystem

**Phase 0: Foundation** — Monolithic Next.js 14 banking platform

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)]()

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Default Credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@thebnk.com | Admin@123! |
| Test User | test@thebnk.com | Test@123! |

## Features (Phase 0)

- JWT auth with access/refresh token rotation
- TOTP 2FA via speakeasy
- Admin RBAC with 4 roles
- Admin dashboard with KPIs
- User management with search + pagination
- 20-table PostgreSQL schema via Prisma
- Audit logging on all sensitive actions
- Rate limiting on auth endpoints
- Zod input validation
- Responsive Tailwind CSS design

## Architecture

Monolithic Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL. See full roadmap in [PLAN.md](./PLAN.md).

## Environment Variables

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection |
| JWT_ACCESS_SECRET | HMAC key for access tokens |
| JWT_REFRESH_SECRET | HMAC key for refresh tokens |
| NEXT_PUBLIC_APP_URL | App URL |

## Repo

https://github.com/emmanuelowighoyota9-cmd/the-bnk

## License

Private — All rights reserved.