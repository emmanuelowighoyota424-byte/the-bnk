'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Row = Record<string, unknown>;
type Pagination = { page: number; pageSize: number; total: number; pageCount: number };

export default function AdminResourcePage({ title, resource, columns }: { title: string; resource: string; columns: string[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/v1/admin/resources/${resource}?q=${encodeURIComponent(q)}&page=${page}&pageSize=25`);
      const body: { success?: boolean; data?: { rows?: Row[]; pagination?: Pagination }; error?: string } = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Request failed');
      setRows(body.data?.rows || []); setPagination(body.data?.pagination || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Request failed'); setRows([]);
    } finally { setLoading(false); }
  }, [page, q, resource]);

  useEffect(() => { void load(); }, [load]);

  const value = (row: Row, key: string): string => {
    const raw = row[key];
    if (raw === null || raw === undefined) return '—';
    if (key.toLowerCase().includes('amount') || key === 'balance' || key === 'availableBalance') return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(row.currency || 'USD') }).format(Number(raw));
    if (key.endsWith('At') || key === 'createdAt' || key === 'openedAt') return new Date(String(raw)).toLocaleString();
    if (typeof raw === 'object') { const objectValue = raw as Record<string, unknown>; return String(objectValue.email || objectValue.accountNumber || JSON.stringify(raw)); }
    return String(raw);
  };

  const detailHref = (row: Row) => (resource === 'customers' || resource === 'users') && typeof row.id === 'string' ? `/admin/customers/${row.id}` : null;

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><Link href="/admin/dashboard" className="text-sm font-semibold text-indigo-700">← Admin</Link><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">Search, review and open database-backed {title.toLowerCase()}.</p></div>
      <div className="flex w-full gap-2 sm:w-auto"><input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} onKeyDown={(event) => { if (event.key === 'Enter') void load(); }} placeholder="Search" aria-label={`Search ${title}`} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:w-64"/><button type="button" onClick={() => void load()} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Search</button></div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {loading ? <div className="space-y-3 p-6">{[1,2,3,4].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b bg-slate-50"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{column}</th>)}{rows.some((row) => detailHref(row)) && <th className="px-4 py-3">Action</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id || index)} className="border-b last:border-0 hover:bg-slate-50">{columns.map((column) => { const key = column.charAt(0).toLowerCase() + column.slice(1); return <td key={column} className="whitespace-nowrap px-4 py-4 text-slate-700">{value(row, key)}</td>; })}{detailHref(row) && <td className="px-4 py-4"><Link href={detailHref(row) as string} className="font-semibold text-indigo-700 hover:text-indigo-900">View details →</Link></td>}</tr>)}</tbody></table></div>}
      {!loading && !rows.length && <p className="p-10 text-center text-sm text-slate-500">No records found.</p>}
      {!loading && pagination && pagination.total > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3 text-sm"><span className="text-slate-500">Page {pagination.page} of {pagination.pageCount} · {pagination.total} records</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border bg-white px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Previous</button><button type="button" disabled={page >= pagination.pageCount} onClick={() => setPage((current) => Math.min(pagination.pageCount, current + 1))} className="rounded-lg border bg-white px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div>}
    </div>
  </main>;
}
