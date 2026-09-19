'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Account = {
  id: string;
  accountType: string;
  accountNumber: string;
  routingNumber: string;
  balance: string | number;
  availableBalance: string | number;
  currency: string;
  status: string;
  interestRate: string | number | null;
  openedAt: string;
};

type Customer = {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  bnkTag: string | null;
  dateOfBirth: string | null;
  kycStatus: string;
  kycTier: number;
  status: string;
  country: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  createdAt: string;
  updatedAt: string;
  totpEnabled: boolean;
  sms2faEnabled: boolean;
  accounts: Account[];
  _count: { transactions: number; deposits: number; withdrawals: number; cards: number; notifications: number };
};

const money = (value: string | number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0));
const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const mask = (value: string) => (value.length > 4 ? `•••• ${value.slice(-4)}` : value);

export default function AdminCustomerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/v1/admin/customers/${encodeURIComponent(id)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error || 'Unable to load customer');
        return body.data as Customer;
      })
      .then(setCustomer)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-8"><div className="h-8 w-56 animate-pulse rounded bg-slate-200" /><div className="mt-6 h-48 animate-pulse rounded-3xl bg-slate-200" /><div className="mt-6 h-72 animate-pulse rounded-2xl bg-slate-200" /></main>;
  if (error || !customer) return <main className="mx-auto max-w-2xl px-4 py-16"><div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200"><h1 className="text-xl font-bold">Customer unavailable</h1><p className="mt-2 text-sm text-slate-500">{error || 'The customer could not be found.'}</p><Link href="/admin/customers" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Back to customers</Link></div></main>;

  const fullName = `${customer.firstName} ${customer.lastName}`.trim();
  const toggle = (accountId: string) => setVisible((current) => ({ ...current, [accountId]: !current[accountId] }));

  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link href="/admin/customers" className="text-sm font-semibold text-indigo-700">← Customers</Link><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{fullName || customer.email}</h1><p className="mt-1 text-sm text-slate-500">Customer profile, account numbers and banking details.</p></div>
      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{label(customer.status)}</span>
    </div>

    <section className="mt-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div><p className="text-sm text-slate-400">Customer</p><p className="mt-1 text-xl font-semibold">{fullName}</p><p className="mt-1 text-sm text-slate-400">{customer.email}</p>{customer.bnkTag && <p className="mt-3 text-sm text-slate-300">BNK Tag: <span className="font-semibold">{customer.bnkTag}</span></p>}</div>
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4"><div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-xl font-bold">{customer.accounts.length}</p><p className="text-[11px] text-slate-400">Accounts</p></div><div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-xl font-bold">{customer._count.transactions}</p><p className="text-[11px] text-slate-400">Transactions</p></div><div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-xl font-bold">{customer._count.cards}</p><p className="text-[11px] text-slate-400">Cards</p></div><div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-xl font-bold">{customer.kycTier}</p><p className="text-[11px] text-slate-400">KYC tier</p></div></div>
      </div>
    </section>

    <section className="mt-6">
      <div className="mb-4"><h2 className="text-xl font-bold text-slate-950">Bank accounts</h2><p className="mt-1 text-sm text-slate-500">Account numbers are protected by default and can be revealed when required.</p></div>
      {customer.accounts.length === 0 ? <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200"><p className="font-semibold">No active accounts</p><p className="mt-1 text-sm text-slate-500">This customer has no non-closed accounts.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{customer.accounts.map((account) => <article key={account.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="bg-slate-900 p-6 text-white"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label(account.accountType)}</p><p className="mt-3 text-3xl font-bold">{money(account.balance, account.currency)}</p><p className="mt-1 text-sm text-slate-400">Available {money(account.availableBalance, account.currency)}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{label(account.status)}</span></div></div>
        <div className="space-y-4 p-6"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Account number</p><p className="mt-1 break-all font-mono text-lg font-bold tracking-wider text-slate-950">{visible[account.id] ? account.accountNumber : mask(account.accountNumber)}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => toggle(account.id)} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white">{visible[account.id] ? 'Hide number' : 'Reveal number'}</button><button type="button" onClick={() => navigator.clipboard.writeText(account.accountNumber)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">Copy number</button></div></div><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Routing number</dt><dd className="mt-1 font-mono text-sm font-semibold">{account.routingNumber}</dd></div><div><dt className="text-xs text-slate-500">Currency</dt><dd className="mt-1 text-sm font-semibold">{account.currency}</dd></div><div><dt className="text-xs text-slate-500">Opened</dt><dd className="mt-1 text-sm font-semibold">{new Date(account.openedAt).toLocaleDateString()}</dd></div><div><dt className="text-xs text-slate-500">Interest rate</dt><dd className="mt-1 text-sm font-semibold">{account.interestRate == null ? '—' : `${Number(account.interestRate).toFixed(2)}%`}</dd></div></dl><Link href={`/admin/accounts?q=${encodeURIComponent(account.accountNumber)}`} className="inline-flex text-sm font-bold text-indigo-700">Open in accounts →</Link></div>
      </article>)}</div>}
    </section>

    <section className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="font-bold text-slate-950">Customer details</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{[['Email', customer.email], ['Phone', customer.phone || '—'], ['KYC status', label(customer.kycStatus)], ['Country', customer.country || '—'], ['City', customer.city || '—'], ['State', customer.state || '—'], ['ZIP', customer.zipCode || '—'], ['Joined', new Date(customer.createdAt).toLocaleDateString()]].map(([name, value]) => <div key={name}><dt className="text-xs text-slate-500">{name}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}</dl></div>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="font-bold text-slate-950">Security</h2><dl className="mt-4 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Authenticator 2FA</dt><dd className="font-semibold">{customer.totpEnabled ? 'Enabled' : 'Disabled'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">SMS 2FA</dt><dd className="font-semibold">{customer.sms2faEnabled ? 'Enabled' : 'Disabled'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Deposits</dt><dd className="font-semibold">{customer._count.deposits}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Withdrawals</dt><dd className="font-semibold">{customer._count.withdrawals}</dd></div></dl></div>
    </section>
  </main>;
}
