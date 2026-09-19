'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/v1/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Invalid administrator credentials.');
        return;
      }
      router.replace('/admin/dashboard');
      router.refresh();
    } catch {
      setError('We could not sign you in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2">
        <section className="hidden border-r border-white/10 bg-slate-900/60 p-10 lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="Crestline Capital home">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-lg font-bold">C</span>
            <span className="text-xl font-semibold tracking-tight">Crestline Capital</span>
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">Operations</p>
            <h1 className="mt-4 max-w-md text-4xl font-semibold tracking-tight">Secure access for Crestline Capital administrators.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-400">Manage customers, accounts, transactions and operational workflows from one protected workspace.</p>
          </div>
          <p className="text-xs text-slate-500">Authorized personnel only. Activity may be recorded for security and audit purposes.</p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 font-bold">C</span>
              <span className="text-xl font-semibold">Crestline Capital</span>
            </Link>
            <div className="mb-8">
              <div className="mb-5 inline-flex items-center rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-200">Administrator portal</div>
              <h2 className="text-3xl font-semibold tracking-tight">Sign in</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Use your authorized administrator account to continue.</p>
            </div>

            {error && <div role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="admin-email" className="mb-2 block text-sm font-medium text-slate-200">Email address</label>
                <input id="admin-email" name="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" placeholder="admin@crestlinecapital.com" required />
              </div>
              <div>
                <label htmlFor="admin-password" className="mb-2 block text-sm font-medium text-slate-200">Password</label>
                <input id="admin-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" placeholder="Enter your password" required />
              </div>
              <button type="submit" disabled={loading} className="min-h-12 w-full rounded-xl bg-indigo-600 px-5 text-sm font-semibold shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Signing in…' : 'Sign in to admin'}</button>
            </form>

            <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-500">
              <Link href="/" className="transition hover:text-slate-300">Return to Crestline Capital</Link>
              <span>Protected connection</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
