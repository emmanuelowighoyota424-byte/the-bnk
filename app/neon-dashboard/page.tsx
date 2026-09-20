"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { neonAuthClient } from "@/lib/auth/neon-client"
import { Button } from "@/components/ui/button"

export default function NeonDashboardPage() {
  const router = useRouter()
  const { data: session, isPending } = neonAuthClient.useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/neon-auth/sign-in")
    }
  }, [session, isPending, router])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await neonAuthClient.signOut()
      router.push("/neon-auth/sign-in")
    } catch (error) {
      console.error("Sign out error:", error)
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleContinueToApp = () => {
    // Set local storage to indicate logged in state
    localStorage.setItem("chase_logged_in", "true")
    localStorage.setItem("chase_user_id", session?.user?.id || "neon-user")
    localStorage.setItem("chase_user_name", session?.user?.name || session?.user?.email || "")
    localStorage.setItem("chase_user_email", session?.user?.email || "")
    localStorage.setItem("chase_last_login", new Date().toISOString())
    localStorage.setItem("chase_auth_provider", "neon")
    
    // Redirect to main app
    router.push("/")
  }

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a4fa6]/5 to-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-[#0a4fa6] animate-spin" />
          <p className="text-gray-600 font-medium">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a4fa6]/5 to-white p-4">
      <div className="max-w-md mx-auto pt-12">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#00e5bf] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
            <p className="text-gray-600 mt-2">You are signed in with Neon Auth</p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{session.user?.email || "N/A"}</p>
            </div>
            {session.user?.name && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{session.user.name}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">User ID</p>
              <p className="font-mono text-sm text-gray-900">{session.user?.id}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleContinueToApp}
              className="w-full bg-[#0a4fa6] hover:bg-[#083d85] text-white py-6"
            >
              Continue to Chase
            </Button>
            <Button
              onClick={handleSignOut}
              disabled={isSigningOut}
              variant="outline"
              className="w-full py-6"
            >
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/neon-account/settings"
              className="text-sm text-[#0a4fa6] hover:underline"
            >
              Manage Account Settings
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
