'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Account { id: string; accountType: string; accountNumber: string; balance: number; availableBalance: number; currency: string; status: string; }

export default function DashboardPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/v1/accounts');
        if (res.ok) { const data = await res.json(); if (data.success) setAccounts(data.data); }
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const handleLogout = async () => { await fetch('/api/v1/auth/logout', { method: 'POST' }); router.push('/login'); };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between"><Link href="/dashboard" className="flex items-center gap-2"><div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-lg">B</span></div><span className="text-gray-900 font-bold text-xl">The Bnk</span></Link><button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">Sign Out</button></div></header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8"><h1 className="text-2xl font-bold text-gray-900">Welcome back!</h1><p className="text-gray-500">Here&apos;s your financial overview.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {accounts.map((acc) => (<div key={acc.id} className="stat-card"><div className="flex items-center justify-between mb-3"><span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">{acc.accountType.replace(/_/g, ' ')}</span><span className={`w-2 h-2 rounded-full ${acc.status==='active'?'bg-green-400':'bg-yellow-400'}`} /></div><p className="text-3xl font-bold text-gray-900 mb-1">{new Intl.NumberFormat('en-US',{style:'currency',currency:acc.currency}).format(acc.balance)}</p><p className="text-sm text-gray-500">Available: {new Intl.NumberFormat('en-US',{style:'currency',currency:acc.currency}).format(acc.availableBalance)}</p><p className="text-xs text-gray-400 mt-2">Account ••••{acc.accountNumber.slice(-4)}</p></div>))}
          {accounts.length === 0 && <div className="stat-card col-span-full text-center py-12"><p className="text-gray-400 text-lg">No accounts yet.</p><p className="text-gray-400 text-sm mt-1">Open your first account to get started.</p></div>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{['Transfer ↔️','Deposit 📥','Pay Bills 📋','Cards 💳'].map((a) => (<div key={a} className="card text-center hover:shadow-md transition-shadow cursor-pointer"><div className="text-2xl mb-2">{a.split(' ')[1]}</div><span className="text-sm font-medium text-gray-700">{a.split(' ')[0]}</span></div>))}</div>
      </main>
    </div>
  );
}