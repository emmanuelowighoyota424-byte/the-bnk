import { AuthView } from "@neondatabase/auth/react/ui"
import { authViewPaths } from "@neondatabase/auth/react/ui/server"

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function NeonAuthPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = await params

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a4fa6]/5 to-white p-4">
      <div className="w-full max-w-md">
        <AuthView path={path} />
      </div>
    </main>
  )
}
