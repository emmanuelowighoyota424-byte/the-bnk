'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const groups = [
  { title: 'Overview & People', items: [
    ['dashboard', 'Overview'], ['users', 'Users'], ['customers', 'Customers'], ['kyc', 'KYC'], ['leads', 'Leads'], ['tasks', 'Tasks'], ['referrals', 'Referrals'], ['import', 'Import'],
  ]},
  { title: 'Money & Financial Ledger', items: [
    ['deposits', 'Deposits'], ['withdrawals', 'Withdrawals'], ['transfers', 'Transfers'], ['transactions', 'Transactions'], ['accounts', 'Accounts'], ['payment-methods', 'Payment Methods'], ['cards', 'Cards'], ['card-setup', 'Card Setup'], ['currencies', 'Currencies'], ['loans', 'Loans'], ['grants', 'Grants'], ['irs', 'Compliance / Tax'], ['membership', 'Membership'],
  ]},
  { title: 'Trading & Engagement', items: [
    ['plans', 'Plans'], ['crypto', 'Crypto'], ['signals', 'Signals'], ['providers', 'Providers'], ['copy-trading', 'Copy Trading'], ['courses', 'Courses'], ['inbox', 'Inbox'], ['tickets', 'Tickets'], ['live-chat', 'Live Chat'], ['contact', 'Contact'], ['broadcast', 'Broadcast'], ['agents', 'Agents'], ['testimonials', 'Testimonials'],
  ]},
  { title: 'Site & System Configuration', items: [
    ['appearance', 'Appearance'], ['themes', 'Themes'], ['assets', 'Assets'], ['content', 'Content'], ['faq', 'FAQ'], ['audit-logs', 'Audit Log'], ['roles', 'Roles'], ['settings', 'Settings'],
  ]},
];

function icon(name: string) {
  const icons: Record<string, string> = { dashboard: '⌂', users: '◉', customers: '◎', kyc: '✓', leads: '◇', tasks: '☑', referrals: '↗', import: '⇩', deposits: '↓', withdrawals: '↑', transfers: '⇄', transactions: '▤', accounts: '▥', 'payment-methods': '▣', cards: '▭', 'card-setup': '⚙', currencies: '$', loans: '◫', grants: '✦', irs: '§', membership: '♢', plans: '◈', crypto: '₿', signals: '⌁', providers: '⌘', 'copy-trading': '⧉', courses: '▹', inbox: '✉', tickets: '▱', 'live-chat': '◌', contact: '☎', broadcast: '◁', agents: '♙', testimonials: '★', appearance: '◐', themes: '◑', assets: '▧', content: '☷', faq: '?', 'audit-logs': '≡', roles: '♟', settings: '⚙' };
  return icons[name] || '•';
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isLogin = pathname === '/admin/login';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function logout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }

  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <button aria-label="Open admin navigation" onClick={() => setOpen(true)} className="fixed left-4 top-4 z-50 grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-slate-900/95 text-lg shadow-xl backdrop-blur lg:left-6">☰</button>
      {open && <button aria-label="Close navigation backdrop" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]" />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[292px] max-w-[88vw] flex-col border-r border-white/10 bg-slate-950 shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-5">
          <Link href="/admin/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 font-bold">C</span>
            <span className="font-semibold tracking-tight">Crestline <span className="text-slate-500">Admin</span></span>
          </Link>
          <button aria-label="Close admin navigation" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white">×</button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => <div key={group.title} className="mb-6">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map(([slug, label]) => {
                const href = slug === 'dashboard' ? '/admin/dashboard' : `/admin/${slug}`;
                const active = pathname === href || (slug !== 'dashboard' && pathname.startsWith(`${href}/`));
                return <Link key={slug} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-indigo-600/15 font-semibold text-indigo-300' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'}`}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center text-xs">{icon(slug)}</span><span>{label}</span>
                </Link>;
              })}
            </div>
          </div>)}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link href="/" className="mb-1 block rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/[0.04] hover:text-white">← Customer site</Link>
          <button onClick={logout} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-300 hover:bg-red-500/10 hover:text-red-300">Sign out</button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-0">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 pl-16 sm:px-6 sm:pl-20 lg:px-8 lg:pl-20">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-400">Crestline Capital</p><p className="text-sm font-medium text-slate-300">Administration Console</p></div>
            <div className="hidden items-center gap-3 sm:flex"><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">Protected session</span><button onClick={logout} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white">Sign out</button></div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
