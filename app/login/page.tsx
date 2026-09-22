"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true)
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", email, password }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to sign in")
      if (data.requiresTOTP) throw new Error("Two-factor verification is required in the banking app.")
      window.location.href = "/dashboard"
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in") } finally { setLoading(false) }
  }
  return <main className="grid min-h-screen bg-[#f6f8fb] text-[#10233f] lg:grid-cols-[.9fr_1.1fr]"><section className="hidden bg-[#10233f] p-10 text-white lg:flex lg:flex-col lg:justify-between"><Link href="/" className="flex items-center gap-3 text-lg font-semibold"><span className="flex size-10 items-center justify-center rounded-xl bg-[#b88b43] text-lg">C</span>Crestline Capital</Link><div className="max-w-md"><p className="text-sm uppercase tracking-[0.2em] text-[#efd29e]">Your financial home</p><h1 className="mt-5 text-5xl font-semibold leading-tight tracking-[-0.04em]">A clearer way to move forward.</h1><p className="mt-6 leading-7 text-white/65">Secure access to your accounts, plans, and everyday banking.</p></div><p className="text-sm text-white/50">Protected by layered account security.</p></section><section className="flex items-center justify-center px-6 py-10"><div className="w-full max-w-md"><Link href="/" className="mb-12 inline-flex items-center gap-2 text-sm text-[#52627a] hover:text-[#10233f]"><ArrowLeft className="size-4" /> Back to Crestline</Link><div className="mb-8"><div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-[#10233f] text-xl font-semibold text-white lg:hidden">C</div><p className="text-sm font-medium text-[#b88b43]">Welcome back</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in to your accounts</h2><p className="mt-3 text-[#52627a]">Use the email and password associated with your Crestline profile.</p></div>{error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<form onSubmit={submit} className="flex flex-col gap-5"><label className="flex flex-col gap-2 text-sm font-medium">Email address<input className="h-12 rounded-xl border border-[#cbd6e3] bg-white px-4 outline-none focus:border-[#b88b43] focus:ring-2 focus:ring-[#b88b43]/20" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="flex flex-col gap-2 text-sm font-medium">Password<span className="relative"><input className="h-12 w-full rounded-xl border border-[#cbd6e3] bg-white px-4 pr-12 outline-none focus:border-[#b88b43] focus:ring-2 focus:ring-[#b88b43]/20" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-[#52627a]">{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></span></label><div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-medium text-[#8a642d] hover:underline">Forgot password?</Link></div><button disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#10233f] font-medium text-white transition hover:bg-[#1b365c] disabled:opacity-60"><LockKeyhole className="size-4" />{loading ? "Signing in..." : "Sign in securely"}</button></form><p className="mt-7 text-center text-sm text-[#52627a]">New to Crestline? <Link href="/register" className="font-semibold text-[#8a642d] hover:underline">Open an account</Link></p></div></section></main>
}
