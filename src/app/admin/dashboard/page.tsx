'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Metrics {
  users: { total: number; active: number };
  accounts: { total: number; totalBalance: number };
  kyc: { pending: number };
  transactions: { today: number };
  disputes: { open: number };
  fraud: { openAlerts: number };
}

const groups = [
  ['People', [['Customers', '/admin/customers'], ['Users', '/admin/users'], ['KYC', '/admin/kyc'], ['Referrals', '/admin/referrals']]],
  ['Financial operations', [['Deposits', '/admin/deposits'], ['Withdrawals', '/admin/withdrawals'], ['Transfers', '/admin/transfers'], ['Transactions', '/admin/transactions'], ['Accounts', '/admin/accounts']]],
  ['Operations', [['Cards', '/admin/cards'], ['Loans', '/admin/loans'], ['Currencies', '/admin/currencies'], ['Payment Methods', '/admin/payment-methods']]],
  ['System', [['Audit Log', '/admin/audit-logs'], ['Roles', '/admin/roles'], ['Settings', '/admin/settings'], ['Appearance', '/admin/appearance']]],
];

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/admin/metrics', { cache: 'no-store' })
      .then(async (r) => { const x = await r.json(); if (!r.ok || !x.success) throw new Error(x.error || 'Unable to load metrics'); setMetrics(x.data); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load metrics'))
      .finally(() => setLoading(false));
  }, []);

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const cards: [string, string | number][] = [
    ['Customers', metrics?.users.total ?? 0],
    ['Active customers', metrics?.users.active ?? 0],
    ['Accounts', metrics?.accounts.total ?? 0],
    ['Total account balances', money.format(metrics?.accounts.totalBalance ?? 0)],
    ["Today's transactions", metrics?.transactions.today ?? 0],
    ['Pending KYC', metrics?.kyc.pending ?? 0],
    ['Open disputes', metrics?.disputes.open ?? 0],
    ['Open fraud alerts', metrics?.fraud.openAlerts ?? 0],
  ];

  return <main>
    <div className="pl-10 sm:pl-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-400">Operations</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Platform overview</h1><p className="mt-1 text-sm text-slate-400">Live metrics sourced from the Crestline Capital PostgreSQL database.</p></div>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
    <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight text-white">{loading ? '—' : value}</p></div>)}</section>
    <section className="mt-9 space-y-7">{groups.map(([title, items]) => <div key={String(title)}><div className="mb-3"><h2 className="text-base font-semibold text-white">{String(title)}</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(items as string[][]).map(([label, href]) => <Link key={href} href={href} className="group rounded-2xl border border-white/10 bg-slate-900 p-5 transition hover:border-indigo-400/40 hover:bg-slate-900/80"><p className="font-semibold text-slate-100">{label}</p><p className="mt-2 text-xs text-slate-500">Open workspace <span className="text-indigo-400 transition group-hover:translate-x-0.5">→</span></p></Link>)}</div></div>)}</section>
  </main>;
}
