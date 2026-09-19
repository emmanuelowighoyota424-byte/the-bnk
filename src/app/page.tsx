import Link from 'next/link';

const features = [
  ['01', 'Everyday banking', 'USD checking, account numbers, balances and transaction history in one place.'],
  ['02', 'Move money securely', 'Send money to another Crestline Capital customer with an email confirmation code.'],
  ['03', 'Account security', 'Review sessions, authentication and sensitive account activity from a dedicated security center.'],
  ['04', 'Clear account visibility', 'Open an account, view account details and understand every transaction without unnecessary clutter.'],
  ['05', 'Cards', 'View your Crestline Capital cards and the accounts connected to them.'],
  ['06', 'Administrative controls', 'Account restrictions and service messages are surfaced clearly when a banking action is unavailable.'],
];

const stats = [
  ['24/7', 'Digital access'],
  ['USD', 'Primary currency'],
  ['6-digit', 'Email confirmations'],
  ['1 place', 'Accounts + activity'],
];

const steps = [
  ['01', 'Create your account', 'Register with Crestline Capital and get your banking workspace.'],
  ['02', 'See your account', 'Review your USD account number, balance, available funds and activity.'],
  ['03', 'Move money', 'Transfer funds securely when the transaction is available to your account.'],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Primary navigation">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-lg font-bold text-white">C</span>
            <span className="text-lg font-semibold tracking-tight">Crestline Capital</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <Link href="#features" className="hover:text-slate-950">Banking</Link>
            <Link href="#how-it-works" className="hover:text-slate-950">How it works</Link>
            <Link href="#security" className="hover:text-slate-950">Security</Link>
            <Link href="/about" className="hover:text-slate-950">About</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Sign in</Link>
            <Link href="/register" className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800">Open an account</Link>
          </div>
        </nav>
      </header>

      <section className="overflow-hidden border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-32">
          <div>
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-indigo-700">Digital banking, clearly connected</p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.03] tracking-[-0.04em] sm:text-7xl">Banking that keeps your money, movement and security in view.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">A focused digital banking experience for everyday USD accounts, secure transfers, account visibility and customer-controlled security.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-indigo-700 px-7 text-sm font-semibold text-white hover:bg-indigo-800">Open an account</Link>
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-7 text-sm font-semibold hover:bg-slate-50">Sign in</Link>
            </div>
          </div>
          <div className="relative rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <span className="text-sm font-semibold">Crestline account</span>
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">Protected</span>
            </div>
            <p className="mt-10 text-sm text-slate-400">Available balance</p>
            <p className="mt-2 text-4xl font-semibold">••••••</p>
            <div className="mt-9 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><p className="text-xs text-slate-400">Transfers</p><p className="mt-1 font-semibold">Email verified</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><p className="text-xs text-slate-400">Activity</p><p className="mt-1 font-semibold">Always visible</p></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Crestline Capital highlights" className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={value} className="bg-white px-6 py-8">
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-700">Banking in one place</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">The essential banking tools, connected.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">Move from account overview to money movement, cards and security without losing context.</p>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-slate-200 bg-slate-200 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([number, title, description]) => (
            <article key={number} className="min-h-64 bg-white p-8">
              <span className="text-xs font-bold text-indigo-700">{number}</span>
              <h3 className="mt-14 text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-200 bg-slate-50 px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-700">Simple by design</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">From registration to everyday banking.</h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {steps.map(([number, title, description]) => (
              <article key={number} className="rounded-3xl border border-slate-200 bg-white p-8">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-950 text-xs font-bold text-white">{number}</span>
                <h3 className="mt-10 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="bg-slate-950 px-5 py-24 text-white sm:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-300">Security first</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Sensitive actions require another step.</h2>
            <p className="mt-6 max-w-xl leading-8 text-slate-400">Crestline Capital surfaces security controls alongside the banking actions they protect.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 p-7"><p className="font-semibold">Email confirmation codes</p><p className="mt-3 text-sm leading-7 text-slate-400">Transfers and withdrawals can require a one-time six-digit code delivered to the customer email address.</p></div>
            <div className="rounded-3xl border border-white/10 p-7"><p className="font-semibold">Account restrictions</p><p className="mt-3 text-sm leading-7 text-slate-400">When a transaction type is restricted, the configured service message is shown instead of a generic failure.</p></div>
            <div className="rounded-3xl border border-white/10 p-7"><p className="font-semibold">Financial audit trail</p><p className="mt-3 text-sm leading-7 text-slate-400">Administrative balance adjustments are recorded with a reason and audit entry.</p></div>
            <div className="rounded-3xl border border-white/10 p-7"><p className="font-semibold">Ledger-first movement</p><p className="mt-3 text-sm leading-7 text-slate-400">Financial changes flow through the authoritative journal and ledger path.</p></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="rounded-[2rem] bg-indigo-50 p-8 sm:p-12 lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-700">Start with Crestline Capital</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Open your digital banking account.</h2>
            <p className="mt-3 max-w-2xl text-slate-600">Create your account and get access to your banking dashboard, account details and secure money movement.</p>
          </div>
          <Link href="/register" className="mt-7 inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 px-7 text-sm font-semibold text-white lg:mt-0">Get started</Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-sm text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div><p className="font-semibold text-slate-900">Crestline Capital</p><p className="mt-1">Digital banking for everyday money management.</p></div>
          <div className="flex flex-wrap gap-5"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/cards">Cards</Link><Link href="/admin/login">Admin</Link></div>
        </div>
      </footer>
    </main>
  );
}