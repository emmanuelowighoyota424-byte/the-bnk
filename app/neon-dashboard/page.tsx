import { redirect } from "next/navigation"

/**
 * Legacy Neon Auth route.
 * Neon Auth was removed from the production authentication architecture;
 * send legacy traffic through the Prisma-backed customer login flow.
 */
export default function NeonDashboardPage() {
  redirect("/login")
}
