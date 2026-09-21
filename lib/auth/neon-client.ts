"use client"

/** Legacy compatibility shim. Production authentication uses the application's Prisma-backed auth. */
export const neonAuthClient = {
  useSession: () => ({ data: null, isPending: false }),
  signOut: async () => undefined,
}
