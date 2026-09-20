"use client"

import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

import { neonAuthClient } from "@/lib/auth/neon-client"

export function NeonAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <NeonAuthUIProvider
      authClient={neonAuthClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => {
        // Clear router cache (protected routes)
        router.refresh()
      }}
      emailOTP
      social={{
        providers: ["google"],
      }}
      redirectTo="/neon-dashboard"
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  )
}
