"use client"

import type { ReactNode } from "react"

/** Legacy compatibility provider. Neon Auth was removed from the production build. */
export function NeonAuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
