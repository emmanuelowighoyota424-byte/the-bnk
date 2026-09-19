'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BankNav from '../../components/BankNav';

interface Account {
  id: string;
  accountType: string;
  accountNumber: string;
  balance: number | string;
  availableBalance: number | string;
  currency: string;
  status: string;
}

const money = (v: number | string, c = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(Number(v || 0));

const title = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const mask = (value: string) => value.length > 4 ? `•••• •••• •••• ${value.slice(-4)}` : value;

  const copyNumber = async (a: Account) => {
    try {
      await navigator.clipboard.writeText(a.accountNumber);
      setCopied(a.id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError('Copy failed. You can select the account number manually.');
    }
  };

  useEffect(() => {
    fetch('/api/v1/accounts')
      .then(async r => {
        const x = await r.json();
        if (!r.ok || !x.success) throw new Error(x.error || 'Unable to load accounts');
        setAccounts(x.data || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f5f2] pb-20 lg:pb-0">
      <BankNav />
      <main className="page-container lg:pl-[17rem]">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">Banking</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Accounts</h1>
          <p className="mt-1 text-sm text-slate-500">View balances, account details, and recent activity.</p>
        </header>

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ) : error && !accounts.length ? (
          <div className="mt-6 card">
            <p className="font-semibold">We could not load your accounts</p>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map(a => (
              <div key={a.id} className="group overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md">
                <div className="bg-[#8f1731] p-6 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-300">{title(a.accountType)}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">{title(a.status)}</span>
                  </div>
                  <p className="mt-8 text-3xl font-bold tracking-tight">{money(a.balance, a.currency)}</p>
                  <p className="mt-1 text-sm text-slate-400">Available {money(a.availableBalance, a.currency)}</p>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account number</p>
                      <p className="mt-1 break-all text-sm font-semibold tracking-wider text-slate-800">
                        {revealed[a.id] ? a.accountNumber : mask(a.accountNumber)}
                      </p>
                    </div>
                    <Link href={`/accounts/${a.id}`} className="shrink-0 text-sm font-semibold text-red-700 hover:text-red-800">
                      View →
                    </Link>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      aria-label={`${revealed[a.id] ? 'Hide' : 'Show'} account number`}
                      onClick={() => setRevealed(v => ({ ...v, [a.id]: !v[a.id] }))}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                    >
                      {revealed[a.id] ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      aria-label="Copy account number"
                      onClick={() => copyNumber(a)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {copied === a.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {!accounts.length && (
              <div className="card col-span-full text-center">
                <p className="font-semibold text-slate-900">No accounts available</p>
                <p className="mt-1 text-sm text-slate-500">Your account will be opened automatically when you register.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
