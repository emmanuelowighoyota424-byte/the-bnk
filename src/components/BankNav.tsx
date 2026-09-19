'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const primary = [
  ['/dashboard', 'Overview'],
  ['/accounts', 'Accounts'],
  ['/transfer', 'Transfer'],
  ['/transactions', 'Transactions'],
  ['/statements', 'Statements'],
];

const secondary = [
  ['/deposit', 'Deposit'],
  ['/withdraw', 'Withdraw'],
  ['/notifications', 'Notifications'],
  ['/profile', 'Profile'],
  ['/security', 'Security'],
];

export default function BankNav() {
  const pathname = usePathname();
  const router = useRouter();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function signOut() {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="Crestline Capital home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-700 text-sm font-bold text-white">C</span>
            <span className="text-base font-bold tracking-tight text-slate-950 sm:text-lg">Crestline Capital</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:block">Notifications</Link>
            <Link href="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700" aria-label="Profile">P</Link>
            <button onClick={signOut} className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 md:block">Sign out</button>
          </div>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-60 border-r bg-white lg:block">
        <nav className="flex h-full flex-col px-3 py-5" aria-label="Primary navigation">
          <div className="space-y-1">
            {primary.map(([href, label]) => <NavLink key={href} href={href} label={label} isActive={active(href)} />)}
          </div>
          <div className="my-5 border-t" />
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Money & Security</p>
          <div className="space-y-1">
            {secondary.map(([href, label]) => <NavLink key={href} href={href} label={label} isActive={active(href)} />)}
          </div>
          <div className="mt-auto rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Need help?</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Review security activity or contact support from your account.</p>
          </div>
        </nav>
      </aside>

      <div className="border-b bg-white lg:pl-60">
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8" aria-label="Secondary navigation">
          {[...primary, ...secondary.slice(0, 2)].map(([href, label]) => <NavLink key={href} href={href} label={label} isActive={active(href)} compact />)}
        </nav>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" aria-label="Mobile navigation">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {[['/dashboard','Home'],['/accounts','Accounts'],['/transfer','Transfer'],['/transactions','Activity'],['/profile','Profile']].map(([href,label]) => (
            <Link key={href} href={href} className={`flex min-h-12 flex-col items-center justify-center rounded-xl text-[11px] font-semibold ${active(href) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>
              <span className="mb-0.5 text-sm" aria-hidden="true">{href === '/dashboard' ? '⌂' : href === '/accounts' ? '▣' : href === '/transfer' ? '↗' : href === '/transactions' ? '≡' : '○'}</span>{label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

function NavLink({ href, label, isActive, compact = false }: { href: string; label: string; isActive: boolean; compact?: boolean }) {
  return <Link href={href} aria-current={isActive ? 'page' : undefined} className={`${compact ? 'px-3 py-2 text-xs' : 'px-3 py-2.5 text-sm'} block whitespace-nowrap rounded-lg font-semibold transition ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>{label}</Link>;
}
