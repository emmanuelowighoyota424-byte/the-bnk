'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface User { id: string; email: string; firstName: string; lastName: string; bnkTag: string | null; kycStatus: string; kycTier: number; status: string; createdAt: string; _count: { accounts: number }; }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = useCallback(async (q = '', p = 1) => {
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (q) params.set('search', q);
      const res = await fetch(`/api/v1/admin/users?${params}`);
      if (res.ok) { const data = await res.json(); if (data.success) { setUsers(data.data.users); setTotalPages(data.data.pagination.totalPages); } }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(search, page); }, [page]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); };

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between"><div className="flex items-center gap-8"><Link href="/admin/dashboard" className="flex items-center gap-2"><div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-lg">B</span></div><span className="text-white font-bold text-xl">Admin</span></Link><nav className="hidden sm:flex items-center gap-6"><Link href="/admin/dashboard" className="text-sm text-gray-400 hover:text-gray-200">Dashboard</Link><Link href="/admin/users" className="text-sm text-indigo-400 font-medium">Users</Link><Link href="/admin/roles" className="text-sm text-gray-400 hover:text-gray-200">Roles</Link></nav></div></div></header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6"><h1 className="text-2xl font-bold text-white">User Management</h1><form onSubmit={handleSearch} className="flex gap-2"><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="w-64 px-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" /><button type="submit" className="btn-primary text-sm py-2">Search</button></form></div>
        {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" /></div> : (
          <><div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"><table className="w-full"><thead><tr className="border-b border-gray-700"><th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">User</th><th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Tag</th><th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">KYC</th><th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Status</th><th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Accounts</th><th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Joined</th></tr></thead><tbody className="divide-y divide-gray-700">{users.map((u) => (<tr key={u.id} className="hover:bg-gray-750"><td className="px-6 py-4"><div><p className="text-white font-medium">{u.firstName} {u.lastName}</p><p className="text-gray-400 text-sm">{u.email}</p></div></td><td className="px-6 py-4 text-gray-300 text-sm">${u.bnkTag||'—'}</td><td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.kycStatus==='verified'?'bg-green-500/10 text-green-400':u.kycStatus==='pending'?'bg-yellow-500/10 text-yellow-400':u.kycStatus==='rejected'?'bg-red-500/10 text-red-400':'bg-gray-500/10 text-gray-400'}`}>Tier {u.kycTier} · {u.kycStatus}</span></td><td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.status==='active'?'bg-green-500/10 text-green-400':'bg-red-500/10 text-red-400'}`}>{u.status}</span></td><td className="px-6 py-4 text-gray-300 text-sm">{u._count.accounts}</td><td className="px-6 py-4 text-gray-400 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td></tr>))}</tbody></table>{users.length===0 && <div className="text-center py-12 text-gray-400">No users found.</div>}</div>{totalPages>1 && <div className="flex justify-center gap-2 mt-6"><button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm disabled:opacity-50">Previous</button><span className="flex items-center px-4 text-gray-400 text-sm">Page {page} of {totalPages}</span><button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm disabled:opacity-50">Next</button></div>}</>
        )}
      </main>
    </div>
  );
}