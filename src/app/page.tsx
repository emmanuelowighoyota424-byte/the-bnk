import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 flex flex-col">
      <nav className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2"><div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center"><span className="text-white font-bold text-xl">B</span></div><span className="text-white font-bold text-2xl tracking-tight">Crestline Capital</span></div>
        <div className="flex items-center gap-4"><Link href="/login" className="text-gray-300 hover:text-white font-medium">Sign In</Link><Link href="/register" className="bg-white text-indigo-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-100">Open Account</Link></div>
      </nav>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 mb-8"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /><span className="text-indigo-200 text-sm font-medium">Now in beta — join the waitlist</span></div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight mb-6">One platform.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Every financial decision.</span></h1>
          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">Crestline Capital unifies banking, wealth management, smart cards, and AI-powered analytics into a single, intelligent platform.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4"><Link href="/register" className="btn-primary bg-indigo-600 text-lg px-10 py-4 rounded-xl">Get Started Free</Link><Link href="/admin/login" className="btn-secondary bg-white/5 border-gray-600 text-gray-300 text-lg px-10 py-4 rounded-xl">Admin Portal</Link></div>
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">{['🏦 Core Banking','📈 Wealth & Investing','💳 Smart Cards','🤖 AI Insights'].map((f) => (<div key={f} className="bg-white/5 border border-gray-700 rounded-xl p-4 text-center"><div className="text-2xl mb-1">{f.split(' ')[0]}</div><div className="text-gray-400 text-sm font-medium">{f.slice(2)}</div></div>))}</div>
        </div>
      </main>
      <footer className="text-center py-8 text-gray-500 text-sm">&copy; {new Date().getFullYear()} Crestline Capital. All rights reserved.</footer>
    </div>
  );
}