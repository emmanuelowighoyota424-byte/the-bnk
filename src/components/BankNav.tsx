'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const primary = [
  ['/dashboard', 'Overview', '⌂'],
  ['/accounts', 'Accounts', '▣'],
  ['/transfer', 'Transfer', '↗'],
  ['/transactions', 'Transactions', '≡'],
  ['/statements', 'Statements', '▤'],
];

const money = [
  ['/cards', 'Cards', '▰'],
  ['/withdraw', 'Withdraw', '↑'],
];

const support = [
  ['/notifications', 'Notifications', '●'],
  ['/profile', 'Profile', '○'],
  ['/security', 'Security', '✓'],
];

export default function BankNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function signOut() {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-300 bg-white shadow-sm">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} aria-controls="bank-navigation" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2">
              <span className="sr-only">Open navigation</span>
              <span aria-hidden="true" className="flex flex-col gap-1.5"><span className="h-0.5 w-5 bg-current" /><span className="h-0.5 w-4 bg-current" /><span className="h-0.5 w-5 bg-current" /></span>
            </button>
            <Link href="/dashboard" className="flex items-center gap-3" aria-label="Crestline Capital home">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-700 text-sm font-bold text-white">C</span>
              <span className="text-base font-bold tracking-tight text-slate-950 sm:text-lg">Crestline Capital</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-stone-100 sm:block">Notifications</Link>
            <Link href="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-sm font-semibold text-red-800" aria-label="Profile">P</Link>
            <button onClick={signOut} className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-stone-100 md:block">Sign out</button>
          </div>
        </div>
      </header>

      {open && <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]" />}

      <aside id="bank-navigation" aria-label="Banking navigation" className={`fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[88vw] flex-col border-r border-slate-300 bg-white shadow-2xl transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-700 text-sm font-bold text-white">C</span>
            <span className="font-bold tracking-tight text-slate-950">Crestline Capital</span>
          </Link>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-stone-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600">×</button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Primary">
          <NavGroup label="Overview" items={primary.slice(0, 1)} active={active} />
          <NavGroup label="Banking" items={primary.slice(1)} active={active} />
          <NavGroup label="Money" items={money} active={active} />
          <NavGroup label="Support & security" items={support} active={active} />
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Need help?</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Review security activity or contact support from your account.</p>
            <Link href="/security" onClick={() => setOpen(false)} className="mt-3 inline-flex text-xs font-semibold text-red-700 hover:text-red-800">Open Security Center →</Link>
          </div>
        </nav>
        <div className="shrink-0 border-t border-slate-200 p-3">
          <button type="button" onClick={signOut} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-stone-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-red-600"><span aria-hidden="true">↪</span>Sign out</button>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-300 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" aria-label="Mobile navigation">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {[['/dashboard','Home','⌂'],['/accounts','Accounts','▣'],['/transfer','Transfer','↗'],['/transactions','Activity','≡'],['/profile','Profile','○']].map(([href,label,icon]) => (
            <Link key={href} href={href} className={`flex min-h-12 flex-col items-center justify-center rounded-lg text-[11px] font-semibold ${active(href) ? 'bg-red-50 text-red-700' : 'text-slate-500'}`}>
              <span className="mb-0.5 text-sm" aria-hidden="true">{icon}</span>{label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

function NavGroup({ label, items, active }: { label: string; items: string[][]; active: (href: string) => boolean }) {
  return (
    <section className="mb-5">
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="space-y-1">
        {items.map(([href, text, icon]) => <NavLink key={href} href={href} label={text} icon={icon} isActive={active(href)} />)}
      </div>
    </section>
  );
}

function NavLink({ href, label, icon, isActive }: { href: string; label: string; icon: string; isActive: boolean }) {
  return <Link href={href} aria-current={isActive ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg border-l-4 px-3 text-sm font-semibold transition ${isActive ? 'border-red-700 bg-red-50 text-red-800' : 'border-transparent text-slate-600 hover:bg-stone-50 hover:text-slate-950'}`}><span aria-hidden="true" className="flex w-5 justify-center text-base">{icon}</span>{label}</Link>;
}
