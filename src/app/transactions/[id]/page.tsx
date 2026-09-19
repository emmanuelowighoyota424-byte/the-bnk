'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import BankNav from '../../../components/BankNav';

interface Transaction { id:string; txType:string; amount:number|string; currency:string; description?:string|null; merchantName?:string|null; status:string; createdAt:string; settledAt?:string|null; referenceId?:string|null; account?:{accountNumber:string;currency:string}|null }
const money=(v:number|string,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c}).format(Number(v||0));
const title=(v:string)=>v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function TransactionDetailPage(){
  const {id}=useParams<{id:string}>();
  const [tx,setTx]=useState<Transaction|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  useEffect(()=>{fetch(`/api/v1/transactions/${id}`).then(async r=>{const x=await r.json();if(!r.ok||!x.success)throw new Error(x.error||'Transaction not found');setTx(x.data)}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[id]);
  return <div className="min-h-screen bg-slate-50 pb-20 lg:pb-0"><BankNav/><main className="page-container max-w-4xl lg:pl-[17rem]"><Link href="/transactions" className="text-sm font-semibold text-indigo-700">← Back to transactions</Link>{loading?<div className="mt-5 card animate-pulse"><div className="h-8 w-48 rounded bg-slate-200"/><div className="mt-6 h-20 rounded bg-slate-100"/></div>:error?<div className="mt-5 card"><p className="font-semibold text-slate-900">We couldn't load this transaction</p><p className="mt-1 text-sm text-slate-500">{error}</p></div>:tx&&<><header className="mt-6"><p className="text-sm font-medium text-indigo-700">Transaction details</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{tx.merchantName||tx.description||title(tx.txType)}</h1><p className="mt-2 text-sm text-slate-500">{new Date(tx.createdAt).toLocaleString()}</p></header><section className="mt-6 card"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-slate-500">Amount</p><p className={`mt-1 text-3xl font-bold ${Number(tx.amount)>=0?'text-emerald-700':'text-slate-950'}`}>{Number(tx.amount)>=0?'+':''}{money(tx.amount,tx.currency)}</p></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{title(tx.status)}</span></div><dl className="mt-7 grid gap-x-8 gap-y-5 border-t pt-6 sm:grid-cols-2">{[['Transaction ID',tx.id],['Type',title(tx.txType)],['Account',`••••${tx.account?.accountNumber?.slice(-4)||'----'}`],['Reference',tx.referenceId||'—'],['Created',new Date(tx.createdAt).toLocaleString()],['Completed',tx.settledAt?new Date(tx.settledAt).toLocaleString():'—'],['Description',tx.description||'—']].map(([k,v])=><div key={k}><dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">{k}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{v}</dd></div>)}</dl><div className="mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row"><button className="btn-secondary" onClick={()=>navigator.clipboard?.writeText(tx.id)}>Copy transaction ID</button><Link href="/support" className="btn-secondary">Report an issue</Link></div></section></>}</main></div>;
}
