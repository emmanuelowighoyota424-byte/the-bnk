'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Metrics { users: { total: number; active: number }; accounts: { total: number; totalBalance: number }; kyc: { pending: number }; transactions: { today: number }; disputes: { open: number }; fraud: { openAlerts: number }; }

export default function AdminDashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() { try { const res = await fetch('/api/v1/admin/metrics'); if (res.ok) { const data = await res.json(); if (data.success) setMetrics(data.data); } } finally { setLoading(false); } }
    load();
  }, []);

  const handleLogout = async () => { await fetch('/api/v1/auth/logout', { method: 'POST' }); router.push('/admin/login'); };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" /></div>;

  const stats = [
    { label: 'Total Users', value: metrics?.users.total || 0, sub: `${metrics?.users.active || 0} active`, color: 'indigo' },
    { label: 'Total Balance', value: new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(metrics?.accounts.totalBalance||0), sub: `${metrics?.accounts.total||0} accounts`, color: 'emerald' },
    { label: 'Pending KYC', value: metrics?.kyc.pending || 0, sub: 'Requires review', color: 'yellow' },
    { label: "Today's Txs", value: metrics?.transactions.today || 0, sub: 'Last 24 hours', color: 'blue' },
    { label: 'Open Disputes', value: metrics?.disputes.open || 0, sub: 'Active cases', color: 'orange' },
    { label: 'Fraud Alerts', value: metrics?.fraud.openAlerts || 0, sub: 'Open alerts', color: 'red' },
  ];

  const colorMap: Record<string, string> = { indigo: 'bg-indigo-500/10', emerald: 'bg-emerald-500/10', yellow: 'bg-yellow-500/10', blue: 'bg-blue-500/10', orange: 'bg-orange-500/10', red: 'bg-red-500/10' };

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between"><div className="flex items-center gap-8"><Link href="/admin/dashboard" className="flex items-center gap-2"><div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-lg">B</span></div><span className="text-white font-bold text-xl">Admin</span></Link><nav className="hidden sm:flex items-center gap-6"><Link href="/admin/dashboard" className="text-sm text-indigo-400 font-medium">Dashboard</Link><Link href="/admin/users" className="text-sm text-gray-400 hover:text-gray-200">Users</Link><Link href="/admin/roles" className="text-sm text-gray-400 hover:text-gray-200">Roles</Link></nav></div><button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-200">Sign Out</button></div></header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><h1 className="text-2xl font-bold text-white mb-8">Platform Overview</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{stats.map((stat) => (<div key={stat.label} className="bg-gray-800 rounded-xl border border-gray-700 p-5"><div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${colorMap[stat.color]} mb-3`}><span className={`text-${stat.color}-400`}>{stat.label.charAt(0)}</span></div><p className="text-3xl font-bold text-white mb-1">{typeof stat.value === 'number' && stat.value > 9999 ? `${(stat.value/1000).toFixed(1)}k` : stat.value}</p><p className="text-sm text-gray-400">{stat.label}</p><p className="text-xs text-gray-500 mt-0.5">{stat.sub}</p></div>))}</div>
      </main>
    </div>
  );
}