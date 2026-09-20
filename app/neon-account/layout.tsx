import { NeonAuthProvider } from "@/components/neon-auth-provider"
import "@neondatabase/auth/ui/css"

export default function NeonAccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <NeonAuthProvider>{children}</NeonAuthProvider>
}
