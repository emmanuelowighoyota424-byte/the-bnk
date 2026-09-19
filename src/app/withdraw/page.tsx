'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BankNav from '../../components/BankNav';

type Account={id:string;accountNumber:string;accountType:string;availableBalance:string|number;currency:string;status:string};

export default function WithdrawPage(){
 const [accounts,setAccounts]=useState<Account[]>([]);
 const [form,setForm]=useState({accountId:'',amount:'',destination:'',description:''});
 const [code,setCode]=useState(''); const [sent,setSent]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState('');
 useEffect(()=>{fetch('/api/v1/accounts').then(r=>r.json()).then(x=>setAccounts(x.data||[])).catch(()=>setError('Unable to load your accounts.'));},[]);
 const account=useMemo(()=>accounts.find(x=>x.id===form.accountId),[accounts,form.accountId]);
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setMessage('');setBusy(true);try{
  if(!sent){const r=await fetch('/api/v1/transaction-codes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'WITHDRAWAL',payload:form})});const x=await r.json();if(!r.ok||!x.success)throw new Error(x.error||'Unable to send security code.');setSent(true);setMessage('Security code sent to your email. It expires in 10 minutes.');return;}
  const r=await fetch('/api/v1/withdrawals',{method:'POST',headers:{'content-type':'application/json','idempotency-key':crypto.randomUUID()},body:JSON.stringify({...form,verificationCode:code})});const x=await r.json();if(!r.ok||!x.success)throw new Error(x.error||'Withdrawal could not be submitted.');setMessage('Withdrawal '+(x.data?.reference||'request')+' submitted for approval.');setSent(false);setCode('');
 }catch(e){setError(e instanceof Error?e.message:'Withdrawal failed.')}finally{setBusy(false)}}
 return <><BankNav/><main className="min-h-[calc(100vh-4rem)] bg-[#f6f5f2] pb-24 lg:pb-10"><div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
  <div className="mb-7 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-red-700">Money movement</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Withdraw funds</h1><p className="mt-2 text-sm leading-6 text-slate-500">Request a withdrawal from an eligible Crestline Capital account.</p></div><Link href="/transactions" className="hidden rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:inline-flex">Activity</Link></div>
  <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
   <div className="bg-[#8f1731] p-6 text-white"><p className="text-sm text-white/70">Withdrawal request</p><p className="mt-1 text-xl font-bold">Secure authorization required</p><p className="mt-1 text-sm text-white/70">We will email a one-time security code before the request can be submitted.</p></div>
   <div className="space-y-5 p-6 sm:p-7">
    {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
    {message&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{message}</div>}
    <div><label htmlFor="withdraw-account" className="label-text">Source account</label><select id="withdraw-account" required value={form.accountId} onChange={e=>setForm({...form,accountId:e.target.value})} className="input-field"><option value="">Select an account</option>{accounts.filter(x=>x.status==='active').map(x=><option key={x.id} value={x.id}>{x.accountType.replaceAll('_',' ')} · ••••{x.accountNumber.slice(-4)} — {x.currency} {Number(x.availableBalance).toFixed(2)}</option>)}</select></div>
    <div><label htmlFor="withdraw-amount" className="label-text">Amount</label><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">$</span><input id="withdraw-amount" required inputMode="decimal" className="input-field pl-9 text-xl font-bold" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="0.00"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{account?.currency||'USD'}</span></div>{account&&<p className="mt-2 text-xs text-slate-500">Available: <span className="font-semibold text-slate-800">{account.currency} {Number(account.availableBalance).toFixed(2)}</span></p>}</div>
    <div><label htmlFor="withdraw-destination" className="label-text">Destination</label><input id="withdraw-destination" required className="input-field" value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})} placeholder="Bank account, wallet, or payout destination"/></div>
    <div><label htmlFor="withdraw-description" className="label-text">Description <span className="font-normal text-slate-400">(optional)</span></label><input id="withdraw-description" className="input-field" value={form.description} onChange={e=>setForm({...form,description:e.target.value.slice(0,200)})} placeholder="Purpose of withdrawal"/></div>
    {sent&&<div className="rounded-xl border border-red-100 bg-red-50 p-4"><label htmlFor="withdraw-code" className="label-text text-red-900">Email security code</label><input id="withdraw-code" required inputMode="numeric" maxLength={6} autoFocus className="input-field mt-2 text-center text-xl font-bold tracking-[.35em]" placeholder="000000" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/><p className="mt-2 text-xs text-red-800">Enter the 6-digit code sent to your email. It expires in 10 minutes.</p></div>}
   </div>
   <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-stone-50 p-6 sm:flex-row sm:justify-between"><Link href="/dashboard" className="btn-secondary text-center">Cancel</Link><button disabled={busy||(sent&&code.length!==6)} className="btn-primary min-w-48">{busy?'Processing…':sent?'Confirm withdrawal':'Email me a security code'}</button></div>
  </form>
 </div></main></>;
}