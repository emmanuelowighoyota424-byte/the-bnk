import Link from "next/link"
import { ArrowRight, ShieldCheck, Sparkles, WalletCards } from "lucide-react"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#10233f]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Crestline Capital home">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#10233f] text-lg font-semibold text-white">C</span>
          <span className="text-lg font-semibold tracking-tight">Crestline Capital</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[#52627a] md:flex" aria-label="Main navigation">
          <a href="#solutions" className="transition-colors hover:text-[#10233f]">Solutions</a>
          <a href="#security" className="transition-colors hover:text-[#10233f]">Security</a>
          <a href="#about" className="transition-colors hover:text-[#10233f]">About</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm font-medium text-[#10233f] sm:inline-flex">Sign in</Link>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-[#10233f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1b365c]">Get started <ArrowRight data-icon="inline-end" /></Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-10 lg:pb-28 lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dce4ee] bg-white px-3 py-1.5 text-xs font-medium text-[#52627a]"><Sparkles className="size-3.5 text-[#b88b43]" /> Banking built around your next move</div>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-[#10233f] sm:text-6xl lg:text-7xl">Clarity for your capital. Confidence for your future.</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#52627a]">Crestline Capital brings everyday banking, long-term planning, and intelligent tools together in one secure financial home.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#b88b43] px-6 py-3.5 font-medium text-white transition hover:bg-[#9e7537]">Open your account <ArrowRight data-icon="inline-end" /></Link><Link href="/login" className="inline-flex items-center justify-center rounded-full border border-[#cbd6e3] bg-white px-6 py-3.5 font-medium text-[#10233f] transition hover:bg-[#eef3f8]">Sign in to banking</Link></div>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-[#52627a]"><span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-[#b88b43]" /> FDIC-insured banking</span><span className="inline-flex items-center gap-2"><WalletCards className="size-4 text-[#b88b43]" /> Built for real life</span></div>
        </div>
        <div className="relative overflow-hidden rounded-[2rem] bg-[#10233f] p-5 shadow-2xl shadow-[#10233f]/15 sm:p-7">
          <div className="absolute -right-16 -top-16 size-48 rounded-full border border-white/10" /><div className="absolute -bottom-24 -left-12 size-56 rounded-full border border-white/10" />
          <div className="relative rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur sm:p-7"><div className="flex items-center justify-between text-sm text-white/70"><span>Private client overview</span><span className="rounded-full bg-[#b88b43]/20 px-2.5 py-1 text-xs text-[#efd29e]">Secure</span></div><p className="mt-12 text-sm text-white/60">Total relationship value</p><p className="mt-2 text-4xl font-semibold tracking-tight text-white">$284,650.42</p><div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-white/60">Available cash</p><p className="mt-2 text-lg font-medium text-white">$48,920.18</p></div><div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-white/60">Growth this year</p><p className="mt-2 text-lg font-medium text-[#efd29e]">+12.8%</p></div></div><div className="mt-5 h-24 rounded-xl bg-gradient-to-br from-[#b88b43]/30 to-transparent p-3"><div className="flex h-full items-end gap-2">{[30,44,38,58,50,68,64,84,76,94].map((height, index) => <span key={index} className="flex-1 rounded-t-sm bg-[#efd29e]/70" style={{ height: `${height}%` }} />)}</div></div></div>
        </div>
      </section>
      <section id="solutions" className="border-y border-[#e2e8f0] bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 md:grid-cols-3 lg:px-10"><div><p className="text-sm font-semibold text-[#b88b43]">01</p><h2 className="mt-3 text-xl font-semibold">One clear view</h2><p className="mt-3 leading-7 text-[#52627a]">See balances, spending, transfers, and goals without the noise.</p></div><div><p className="text-sm font-semibold text-[#b88b43]">02</p><h2 className="mt-3 text-xl font-semibold">Security with substance</h2><p className="mt-3 leading-7 text-[#52627a]">Layered protection and real-time signals help keep your money moving safely.</p></div><div id="security"><p className="text-sm font-semibold text-[#b88b43]">03</p><h2 className="mt-3 text-xl font-semibold">Guidance that fits</h2><p className="mt-3 leading-7 text-[#52627a]">Tools for today and thoughtful planning for what comes next.</p></div></div></section>
      <footer id="about" className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-10 text-sm text-[#52627a] sm:flex-row sm:items-center sm:justify-between lg:px-10"><p>© {new Date().getFullYear()} Crestline Capital. Member FDIC.</p><div className="flex gap-5"><Link href="/privacy" className="hover:text-[#10233f]">Privacy</Link><Link href="/terms" className="hover:text-[#10233f]">Terms</Link><Link href="/security" className="hover:text-[#10233f]">Security</Link></div></footer>
    </main>
  )
}
