import { NeonAuthProvider } from "@/components/neon-auth-provider"
import "@neondatabase/auth/ui/css"

export default function NeonDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <NeonAuthProvider>{children}</NeonAuthProvider>
}
