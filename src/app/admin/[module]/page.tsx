'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const config: Record<string, { title: string; description: string; resource?: string }> = {
  users: { title: 'Users', description: 'Customer identity, status and onboarding records.', resource: 'users' },
  customers: { title: 'Customers', description: 'Customer roster with KYC and account context.', resource: 'customers' },
  accounts: { title: 'Accounts', description: 'Customer accounts, balances, currency and status.', resource: 'accounts' },
  transactions: { title: 'Transactions', description: 'Read-only financial activity review.', resource: 'transactions' },
  transfers: { title: 'Transfers', description: 'Internal transfer operations and references.', resource: 'transfers' },
  'audit-logs': { title: 'Audit Log', description: 'Append-only operational and security events.', resource: 'audit-logs' },
  deposits: { title: 'Deposits', description: 'Deposit review queue and status monitoring.' },
  withdrawals: { title: 'Withdrawals', description: 'Withdrawal review queue and status monitoring.' },
  kyc: { title: 'KYC', description: 'Identity verification review workspace.' },
  roles: { title: 'Roles & Permissions', description: 'Administrative role and permission management.' },
  settings: { title: 'Settings', description: 'Protected Crestline Capital platform configuration.' },
  leads: { title: 'Leads', description: 'Prospect and onboarding workflow.' },
  tasks: { title: 'Tasks', description: 'Staff work queue and operational follow-up.' },
  referrals: { title: 'Referrals', description: 'Referral attribution and commission operations.' },
  import: { title: 'Import', description: 'Controlled data-import workspace.' },
  'payment-methods': { title: 'Payment Methods', description: 'Configured payment rails and operational details.' },
  cards: { title: 'Cards', description: 'Card inventory, status and controls.' },
  'card-setup': { title: 'Card Setup', description: 'Card product configuration.' },
  currencies: { title: 'Currencies', description: 'Supported currencies and rate configuration.' },
  loans: { title: 'Loans', description: 'Loan application and servicing operations.' },
  grants: { title: 'Grants', description: 'Grant eligibility and disbursement operations.' },
  irs: { title: 'Compliance / Tax', description: 'Compliance holds, reporting and tax-document status.' },
  membership: { title: 'Membership', description: 'Membership tiers, benefits and assignments.' },
  plans: { title: 'Plans', description: 'Product plan configuration and disclosures.' },
  crypto: { title: 'Crypto', description: 'Supported assets, networks and operational configuration.' },
  signals: { title: 'Signals', description: 'Signal sources and status monitoring.' },
  providers: { title: 'Providers', description: 'Integration health and provider configuration.' },
  'copy-trading': { title: 'Copy Trading', description: 'Master/follower relationships and risk settings.' },
  courses: { title: 'Courses', description: 'Educational content and publishing.' },
  inbox: { title: 'Inbox', description: 'Customer communications and support workflow.' },
  tickets: { title: 'Tickets', description: 'Support ticket queue and resolution workflow.' },
  'live-chat': { title: 'Live Chat', description: 'Customer conversation operations.' },
  contact: { title: 'Contact', description: 'Inbound contact requests.' },
  broadcast: { title: 'Broadcast', description: 'Controlled customer communications.' },
  agents: { title: 'Agents', description: 'Staff accounts, roles and activity.' },
  testimonials: { title: 'Testimonials', description: 'Approved customer-facing testimonials.' },
  appearance: { title: 'Appearance', description: 'Brand and visual configuration.' },
  themes: { title: 'Themes', description: 'Theme and accessibility configuration.' },
  assets: { title: 'Assets', description: 'Brand media and document management.' },
  content: { title: 'Content', description: 'Public site content management.' },
  faq: { title: 'FAQ', description: 'Knowledge-base content management.' },
};

type Row = Record<string, unknown>;

function text(value: unknown) { if (value === null || value === undefined || value === '') return '—'; if (typeof value === 'object') return JSON.stringify(value); return String(value); }
function money(value: unknown, currency = 'USD') { const n = Number(value); return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n) : text(value); }

export default function AdminModulePage({ params }: { params: { module: string } }) {
  const module = params.module;
  const meta = config[module] || { title: module.replace(/-/g, ' '), description: 'Administration workspace.' };
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(Boolean(meta.resource));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!meta.resource) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/v1/admin/resources/${meta.resource}?q=${encodeURIComponent(search)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to load records');
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load records'); }
    finally { setLoading(false); }
  }, [meta.resource, search]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => {
    const preferred: Record<string, string[]> = {
      customers: ['firstName', 'lastName', 'email', 'kycStatus', 'status', 'createdAt'],
      accounts: ['accountNumber', 'accountType', 'currency', 'balance', 'availableBalance', 'status', 'openedAt'],
      transactions: ['txType', 'amount', 'currency', 'status', 'referenceId', 'createdAt'],
      transfers: ['reference', 'senderUserId', 'recipientUserId', 'amount', 'currency', 'status', 'createdAt'],
      'audit-logs': ['actorId', 'actorType', 'action', 'entityType', 'entityId', 'ipAddress', 'createdAt'],
      users: ['firstName', 'lastName', 'email', 'status', 'kycStatus', 'createdAt'],
    };
    if (preferred[module]) return preferred[module];
    return rows[0] ? Object.keys(rows[0]).filter((k) => !['passwordHash', 'totpSecret'].includes(k)).slice(0, 8) : [];
  }, [module, rows]);

  return <main>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 pl-10 sm:pl-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-400">Administration</p><h1 className="mt-1 text-2xl font-bold capitalize tracking-tight text-white">{meta.title}</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">{meta.description}</p></div>
      {meta.resource && <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records" className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400 sm:w-72"/><button className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500">Search</button></form>}
    </div>

    {!meta.resource ? <section className="mt-8 rounded-2xl border border-white/10 bg-slate-900 p-6 sm:p-8"><div className="max-w-2xl"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/10 text-xl text-indigo-300">◇</div><h2 className="mt-5 text-lg font-semibold text-white">Workspace ready for live data</h2><p className="mt-2 text-sm leading-6 text-slate-400">This module is included in the administration shell, but the current Prisma schema does not contain a corresponding production record model or endpoint. No fabricated records are shown and no financial state is simulated.</p><p className="mt-4 text-xs leading-5 text-slate-500">The existing financial modules remain connected to the current PostgreSQL/Prisma backend. This page will surface real records once a matching model and server-side API are added.</p></div></section> : <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      {error && <div role="alert" className="border-b border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</div>}
      {loading ? <div className="space-y-3 p-5">{[1,2,3,4,5].map((n) => <div key={n} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />)}</div> : rows.length === 0 ? <div className="p-12 text-center"><p className="font-semibold text-slate-200">No data available</p><p className="mt-1 text-sm text-slate-500">There are no matching records in the current database.</p></div> : <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left"><thead><tr className="border-b border-white/10">{columns.map((c) => <th key={c} className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">{c.replace(/[A-Z]/g, (m) => ` ${m}`).trim()}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.id || row.reference || i)} className="border-b border-white/5 last:border-0 hover:bg-white/[0.025]">{columns.map((c) => <td key={c} className="max-w-[260px] truncate px-5 py-4 text-sm text-slate-300">{(c === 'balance' || c === 'availableBalance' || c === 'amount' || c === 'totalDebit' || c === 'fee') ? money(row[c], String(row.currency || 'USD')) : c.endsWith('At') || c === 'createdAt' ? text(row[c] ? new Date(String(row[c])).toLocaleString() : row[c]) : text(row[c])}</td>)}</tr>)}</tbody></table></div>}
    </section>}

    <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500"><Link href="/admin/dashboard" className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5 hover:text-slate-300">← Overview</Link>{meta.resource && <button onClick={load} className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5 hover:text-slate-300">Refresh</button>}</div>
  </main>;
}
