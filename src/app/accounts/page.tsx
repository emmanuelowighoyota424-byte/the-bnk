'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BankNav from '@/components/BankNav';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/v1/accounts').then(r => r.json()).then(x => setAccounts(x.data || [])).finally(() => setLoading(false)); }, []);
  const money = (a:any) => new Intl.NumberFormat('en-US', { style:'currency', currency:a.currency || 'USD' }).format(Number(a.balance || 0));
  return <><BankNav/><main className="mx-auto max-w-6xl px-4 py-8"><div className="mb-8"><h1 className="text-3xl font-bold text-slate-900">Accounts</h1><p className="mt-1 text-slate-500">Your persisted Crestline Capital accounts.</p></div>{loading ? <div className="rounded-2xl bg-white p-8 text-center">Loading accounts…</div> : <div className="grid gap-5 md:grid-cols-2">{accounts.map(a => <Link key={a.id} href={`/accounts/${a.id}`} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 hover:ring-indigo-300"><div className="flex justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{String(a.accountType).replace(/_/g,' ')}</span><span className="text-xs font-medium text-emerald-600">{a.status}</span></div><p className="mt-4 text-3xl font-bold text-slate-900">{money(a)}</p><p className="mt-2 text-sm text-slate-500">Account ••••{a.accountNumber.slice(-4)} · Available {new Intl.NumberFormat('en-US',{style:'currency',currency:a.currency}).format(Number(a.availableBalance||0))}</p></Link>)}{!accounts.length && <div className="rounded-2xl bg-white p-10 text-center text-slate-500">No active accounts.</div>}</div>}</main></>;
}
