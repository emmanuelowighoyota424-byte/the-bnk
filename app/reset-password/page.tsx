"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { useSearchParams } from "next/navigation"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const challenge = searchParams.get("challenge") || ""
  const token = searchParams.get("token") || ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) { setError("Passwords do not match."); return }
    setLoading(true); setError("")
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset-password", challengeId: challenge, token, password }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to reset password")
      setMessage(data.message)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reset password") }
    finally { setLoading(false) }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-6 py-12 text-[#10233f]"><div className="w-full max-w-md rounded-[2rem] border border-[#dce4ee] bg-white p-7 shadow-xl sm:p-10"><p className="text-sm font-medium text-[#b88b43]">Crestline Capital</p><h1 className="mt-2 text-3xl font-semibold">Create a new password</h1>{message ? <><p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p><Link href="/login" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#10233f] font-medium text-white">Continue to sign in</Link></> : <form onSubmit={submit} className="mt-7 flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-medium">New password<input className="h-12 rounded-xl border px-4" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label><label className="flex flex-col gap-2 text-sm font-medium">Confirm password<input className="h-12 rounded-xl border px-4" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>{error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<button disabled={loading || !challenge || !token} className="h-12 rounded-xl bg-[#10233f] font-medium text-white disabled:opacity-60">{loading ? "Updating password..." : "Update password"}</button></form>}<p className="mt-7 text-center text-sm text-[#52627a]"><Link href="/login" className="font-semibold text-[#8a642d]">Back to sign in</Link></p></div></main>
}
