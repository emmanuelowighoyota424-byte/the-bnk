'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Role { id: string; name: string; description: string | null; permissions: string[]; _count: { admins: number }; }

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { async function load() { try { const res = await fetch('/api/v1/admin/roles'); if (res.ok) { const data = await res.json(); if (data.success) setRoles(data.data); } } finally { setLoading(false); } } load(); }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between"><div className="flex items-center gap-8"><Link href="/admin/dashboard" className="flex items-center gap-2"><div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-lg">B</span></div><span className="text-white font-bold text-xl">Admin</span></Link><nav className="hidden sm:flex items-center gap-6"><Link href="/admin/dashboard" className="text-sm text-gray-400 hover:text-gray-200">Dashboard</Link><Link href="/admin/users" className="text-sm text-gray-400 hover:text-gray-200">Users</Link><Link href="/admin/roles" className="text-sm text-indigo-400 font-medium">Roles</Link></nav></div></div></header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><h1 className="text-2xl font-bold text-white mb-8">Role Management</h1>
        {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" /></div> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{roles.map((role) => (<div key={role.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6"><div className="flex items-start justify-between mb-4"><div><h3 className="text-lg font-semibold text-white">{role.name}</h3><p className="text-sm text-gray-400 mt-1">{role.description||'No description'}</p></div><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400">{role._count.admins} admin{role._count.admins !== 1 ? 's' : ''}</span></div><div className="flex flex-wrap gap-1.5">{role.permissions.slice(0,12).map((p) => (<span key={p} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">{p}</span>))}{role.permissions.length>12 && <span className="text-xs text-gray-500">+{role.permissions.length-12} more</span>}</div></div>))}</div>
        )}
      </main>
    </div>
  );
}