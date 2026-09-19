'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BankNav from '../../components/BankNav';
import { isCreditTransaction } from '../../lib/transaction-display';

interface Account { id:string; accountType:string; accountNumber:string; balance:number|string; availableBalance:number|string; currency:string; status:string }
interface Transaction { id:string; txType:string; amount:number|string; currency:string; description?:string|null; merchantName?:string|null; status:string; createdAt:string; referenceId?:string|null }
interface Profile { firstName:string; lastName:string; email:string }

const money = (value:number|string, currency='USD') => new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Number(value || 0));
const prettyType = (value:string) => value.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function DashboardPage(){
  const router=useRouter();
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [transactions,setTransactions]=useState<Transaction[]>([]);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(true);
  const [hidden,setHidden]=useState(false);

  useEffect(()=>{
    const saved=window.localStorage.getItem('crestline.balanceHidden');
    if(saved==='true') setHidden(true);
    Promise.all([
      fetch('/api/v1/accounts').then(r=>r.json()),
      fetch('/api/v1/transactions?limit=6').then(r=>r.json()),
      fetch('/api/v1/profile').then(r=>r.json()),
    ]).then(([a,t,p])=>{
      if(a.success) setAccounts(a.data||[]);
      if(t.success) setTransactions(t.data?.items||[]);
      if(p.success) setProfile(p.data||null);
    }).finally(()=>setLoading(false));
  },[]);

  const total=useMemo(()=>accounts.reduce((sum,a)=>sum+Number(a.balance||0),0),[accounts]);
  const available=useMemo(()=>accounts.reduce((sum,a)=>sum+Number(a.availableBalance||0),0),[accounts]);
  const firstName=profile?.firstName || 'there';
  const toggleBalance=()=>{setHidden(v=>{const next=!v;window.localStorage.setItem('crestline.balanceHidden',String(next));return next;})};

  async function logout(){await fetch('/api/v1/auth/logout',{method:'POST'});router.push('/login');router.refresh();}

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <BankNav />
        <main className="page-container lg:pl-[17rem]">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 rounded bg-slate-200" />
            <div className="h-40 rounded-2xl bg-slate-200" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="h-40 rounded-2xl bg-slate-200" />
              <div className="h-40 rounded-2xl bg-slate-200" />
              <div className="h-40 rounded-2xl bg-slate-200" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f5f2] pb-20 lg:pb-0">
      <BankNav />
      <main className="page-container lg:pl-[17rem]">
        <section className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">Account overview</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Good morning, {firstName}</h1>
            <p className="mt-1 text-sm text-slate-500">Here’s your current financial overview.</p>
          </div>
          <button onClick={logout} className="self-start text-sm font-semibold text-slate-500 hover:text-slate-900 sm:self-auto">Sign out</button>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-white/15 bg-[#8f1731] p-6 text-white sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white/75">Total balance</p>
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-3xl font-bold tracking-tight sm:text-4xl">{hidden ? '••••••' : money(total)}</p>
                  <button onClick={toggleBalance} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">{hidden ? 'Show' : 'Hide'}</button>
                </div>
                <p className="mt-2 text-sm text-white/65">Available across {accounts.length} account{accounts.length === 1 ? '' : 's'}</p>
              </div>
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">USD</span>
            </div>
          </div>
          <div className="grid gap-3 bg-white p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available balance</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{hidden ? '••••••' : money(available)}</p>
            </div>
            <div className="sm:text-right">
              <Link href="/accounts" className="inline-flex min-h-10 items-center rounded-lg bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800">View accounts</Link>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="section-title text-slate-950">Quick actions</h2></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Quick href="/transfer" title="Send money" icon="↗" />
            <Quick href="/transfer" title="Transfer" icon="⇄" />
            <Quick href="/cards" title="Cards" icon="▣" />
            <Quick href="/withdraw" title="Withdraw" icon="↑" />
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between"><h2 className="section-title">Your accounts</h2><Link href="/accounts" className="text-sm font-semibold text-red-700">View all</Link></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map(a => (
              <Link key={a.id} href={`/accounts/${a.id}`} className="group rounded-xl border border-slate-300 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{prettyType(a.accountType)}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{prettyType(a.status)}</span></div>
                <p className="mt-5 text-2xl font-bold tracking-tight text-slate-950">{hidden ? '••••••' : money(a.balance, a.currency)}</p>
                <p className="mt-1 text-sm text-slate-500">Available {hidden ? '••••••' : money(a.availableBalance, a.currency)}</p>
                <div className="mt-5 border-t pt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account number</p><p className="mt-1 text-sm font-semibold tracking-wider text-slate-700">•••• •••• {a.accountNumber.slice(-4)}</p><div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">Tap to view full details</span><span className="font-semibold text-red-700 group-hover:underline">View →</span></div></div>
              </Link>
            ))}
            {!accounts.length && <Empty text="No accounts available" detail="Your accounts will appear here once they are opened." />}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="section-title">Recent activity</h2><p className="text-sm text-slate-500">Your latest account transactions.</p></div><Link href="/transactions" className="text-sm font-semibold text-red-700">View all</Link></div>
          <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
            {transactions.length ? transactions.map(tx => (
              <Link key={tx.id} href={`/transactions/${tx.id}`} className="flex items-center justify-between gap-4 border-b p-4 last:border-0 hover:bg-stone-50 sm:p-5">
                <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">{isCreditTransaction(tx.txType) ? '+' : '−'}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{tx.merchantName || tx.description || prettyType(tx.txType)}</p><p className="mt-0.5 text-xs text-slate-500">{new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {prettyType(tx.status)}</p></div></div>
                <span className={`shrink-0 text-sm font-bold ${isCreditTransaction(tx.txType) ? 'text-emerald-700' : 'text-slate-900'}`}>{isCreditTransaction(tx.txType) ? '+' : '−'}{money(tx.amount, tx.currency)}</span>
              </Link>
            )) : <Empty text="No transactions yet" detail="Your transactions will appear here once activity occurs." />}
          </div>
        </section>
      </main>
    </div>
  );
}

function Quick({href,title,icon}:{href:string;title:string;icon:string}){return <Link href={href} className="group flex min-h-24 flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-lg font-semibold text-indigo-700">{icon}</span><span className="text-sm font-semibold text-slate-800 group-hover:text-red-800">{title}</span></Link>}
function Empty({text,detail}:{text:string;detail:string}){return <div className="col-span-full p-8 text-center"><p className="font-semibold text-slate-900">{text}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>}
