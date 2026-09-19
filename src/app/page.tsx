import Link from 'next/link';

const features = [
  ['01', 'Everyday banking', 'See accounts, balances and activity in one clear place.'],
  ['02', 'Move money', 'Transfer money through a guided, security-first experience.'],
  ['03', 'Stay in control', 'Review activity, manage sessions and keep your account secure.'],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Primary navigation">
          <Link href="/" className="flex items-center gap-3" aria-label="Crestline Capital home">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-lg font-bold text-white">C</span>
            <span className="text-lg font-semibold tracking-tight">Crestline Capital</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <Link href="#features" className="hover:text-slate-950">Banking</Link>
            <Link href="/about" className="hover:text-slate-950">About</Link>
            <Link href="/contact" className="hover:text-slate-950">Contact</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Sign in</Link>
            <Link href="/register" className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800">Open an account</Link>
          </div>
        </nav>
      </header>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-28">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Modern banking, made clear</p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-6xl">Banking that puts your money and your decisions first.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Crestline Capital brings everyday accounts, secure money movement and account visibility together in a focused digital banking experience.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-indigo-700 px-6 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800">Get started</Link>
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-800 hover:bg-slate-50">Sign in</Link>
            </div>
            <p className="mt-5 text-xs text-slate-500">Secure account access. Your financial information stays behind authenticated controls.</p>
          </div>
          <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300 sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-5"><span className="text-sm font-medium text-slate-300">Crestline account</span><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">Secure</span></div>
            <p className="mt-8 text-sm text-slate-400">Available balance</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight">••••••</p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><p className="text-xs text-slate-400">Accounts</p><p className="mt-1 font-semibold">Your real data</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><p className="text-xs text-slate-400">Transfers</p><p className="mt-1 font-semibold">Protected</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">Built around you</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">The essentials, without the clutter.</h2></div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 md:grid-cols-3">{features.map(([number, title, text]) => <article key={number} className="bg-white p-7"><span className="text-xs font-semibold text-indigo-700">{number}</span><h3 className="mt-10 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>)}</div>
      </section>

      <section className="bg-slate-950 px-5 py-16 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 sm:flex-row sm:items-center"><div><h2 className="text-2xl font-semibold tracking-tight">Ready to take control of your banking?</h2><p className="mt-2 text-sm text-slate-400">Open your Crestline Capital account or securely sign in.</p></div><Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-100">Open an account</Link></div>
      </section>
      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} Crestline Capital</span><div className="flex gap-5"><Link href="/about" className="hover:text-slate-900">About</Link><Link href="/contact" className="hover:text-slate-900">Contact</Link><Link href="/admin/login" className="hover:text-slate-900">Admin</Link></div></div></footer>
    </main>
  );
}
