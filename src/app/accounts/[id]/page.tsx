'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import BankNav from '../../../components/BankNav';

interface Transaction { id: string; description?: string | null; txType: string; amount: number | string; currency?: string; status: string; referenceId?: string | null; createdAt: string; }
interface AccountUser { id: string; firstName: string; lastName: string; email: string; bnkTag?: string | null; }
interface Account { id: string; accountType: string; accountNumber: string; routingNumber: string; balance: number | string; availableBalance: number | string; currency: string; status: string; interestRate?: number | string | null; openedAt: string; closedAt?: string | null; user: AccountUser; transactions?: Transaction[]; }

const money = (value: number | string, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0));
const title = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const mask = (value: string) => value.length > 4 ? `•••• ${value.slice(-4)}` : value;

export default function AccountDetailsPage() {
  const params = useParams<{ id: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNumber, setShowNumber] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/accounts/${encodeURIComponent(params.id)}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || 'Account not found'); return data.data as Account; })
      .then((data) => { if (!cancelled) setAccount(data); })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.id]);

  const transactions = useMemo(() => account?.transactions ?? [], [account]);

  async function copyAccountNumber() {
    if (!account) return;
    try { await navigator.clipboard.writeText(account.accountNumber); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
  }

  if (loading) return <div className="min-h-screen bg-slate-50"><BankNav /><main className="page-container lg:pl-[17rem]"><div className="h-8 w-40 animate-pulse rounded bg-slate-200" /><div className="mt-5 h-56 animate-pulse rounded-3xl bg-slate-200" /><div className="mt-6 h-72 animate-pulse rounded-2xl bg-slate-200" /></main></div>;
  if (error || !account) return <div className="min-h-screen bg-slate-50"><BankNav /><main className="page-container lg:pl-[17rem]"><div className="card mx-auto max-w-2xl py-12 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-700">!</div><h1 className="mt-4 text-xl font-semibold">Account unavailable</h1><p className="mt-2 text-sm text-slate-500">{error || 'This account could not be found.'}</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white" href="/accounts">Back to accounts</Link></div></main></div>;

  const holderName = `${account.user.firstName} ${account.user.lastName}`.trim();
  return <div className="min-h-screen bg-slate-50 pb-20 lg:pb-0"><BankNav /><main className="page-container lg:pl-[17rem]">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/accounts" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">← Accounts</Link><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{title(account.status)}</span></div>
    <section className="mt-5 overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl"><div className="p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-6"><div><p className="text-sm font-medium text-slate-400">{title(account.accountType)}</p><p className="mt-1 text-sm text-slate-400">Account holder · <span className="font-medium text-slate-200">{holderName}</span></p><p className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{money(account.balance, account.currency)}</p><p className="mt-2 text-sm text-slate-400">Available balance · {money(account.availableBalance, account.currency)}</p></div><div className="min-w-[240px] rounded-2xl border border-white/10 bg-white/[0.05] p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Account number</p><p className="mt-2 break-all text-lg font-semibold tracking-wider">{showNumber ? account.accountNumber : mask(account.accountNumber)}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setShowNumber((visible) => !visible)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">{showNumber ? 'Hide' : 'Show'}</button><button type="button" onClick={copyAccountNumber} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">{copied ? 'Copied' : 'Copy'}</button></div></div></div></div><div className="grid border-t border-white/10 sm:grid-cols-3"><div className="p-5"><p className="text-xs text-slate-500">Routing number</p><p className="mt-1 font-semibold">{account.routingNumber}</p></div><div className="border-t border-white/10 p-5 sm:border-l sm:border-t-0"><p className="text-xs text-slate-500">Currency</p><p className="mt-1 font-semibold">{account.currency}</p></div><div className="border-t border-white/10 p-5 sm:border-l sm:border-t-0"><p className="text-xs text-slate-500">Opened</p><p className="mt-1 font-semibold">{new Date(account.openedAt).toLocaleDateString()}</p></div></div></section>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]"><section className="card p-0"><div className="flex items-center justify-between border-b px-5 py-5 sm:px-6"><div><h2 className="section-title">Recent activity</h2><p className="mt-1 text-xs text-slate-500">Transactions associated with this account.</p></div><Link href={`/transactions?account=${encodeURIComponent(account.id)}`} className="text-sm font-semibold text-indigo-700">View all</Link></div><div className="divide-y">{transactions.map((transaction) => { const credit = ['deposit', 'credit'].includes(transaction.txType.toLowerCase()) || Number(transaction.amount) >= 0; return <div key={transaction.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{transaction.description || title(transaction.txType)}</p><p className="mt-1 truncate text-xs text-slate-500">{new Date(transaction.createdAt).toLocaleString()} · {transaction.referenceId || 'No reference'}</p></div><div className="shrink-0 text-right"><p className={`text-sm font-semibold ${credit ? 'text-emerald-700' : 'text-slate-900'}`}>{credit ? '+' : ''}{money(transaction.amount, transaction.currency || account.currency)}</p><p className="mt-1 text-xs text-slate-500">{title(transaction.status)}</p></div></div>; })}{transactions.length === 0 && <div className="px-6 py-12 text-center"><p className="font-semibold">No transactions yet</p><p className="mt-1 text-sm text-slate-500">Activity for this account will appear here.</p></div>}</div></section><aside className="space-y-4"><div className="card"><h2 className="section-title">Account actions</h2><div className="mt-4 grid gap-2"><Link href={`/transfer?account=${encodeURIComponent(account.id)}`} className="btn-primary w-full">Transfer money</Link><Link href={`/deposit?account=${encodeURIComponent(account.id)}`} className="btn-secondary w-full">Deposit</Link><Link href={`/withdraw?account=${encodeURIComponent(account.id)}`} className="btn-secondary w-full">Withdraw</Link></div></div><div className="card"><h2 className="section-title">Account details</h2><dl className="mt-4 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Account holder</dt><dd className="font-medium text-right">{holderName}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Email</dt><dd className="max-w-[190px] break-all text-right font-medium">{account.user.email}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Type</dt><dd className="font-medium text-right">{title(account.accountType)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd className="font-medium text-right">{title(account.status)}</dd></div>{account.user.bnkTag && <div className="flex justify-between gap-4"><dt className="text-slate-500">BNK Tag</dt><dd className="font-medium text-right">{account.user.bnkTag}</dd></div>}{account.interestRate != null && <div className="flex justify-between gap-4"><dt className="text-slate-500">Interest rate</dt><dd className="font-medium text-right">{Number(account.interestRate).toFixed(2)}%</dd></div>}</dl></div></aside></div>
  </main></div>;
}
