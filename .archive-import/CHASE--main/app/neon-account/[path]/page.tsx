import { AccountView } from "@neondatabase/auth/react/ui"
import { accountViewPaths } from "@neondatabase/auth/react/ui/server"

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(accountViewPaths).map((path) => ({ path }))
}

export default async function NeonAccountPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = await params

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <AccountView path={path} />
      </div>
    </main>
  )
}
