import { execFileSync } from 'node:child_process';

// Vercel installs dependencies before the Next.js build. Apply committed
// Prisma migrations there so production never serves an unmigrated database.
if (process.env.VERCEL !== '1') process.exit(0);
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for Vercel production migrations.');
  process.exit(1);
}

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
});
