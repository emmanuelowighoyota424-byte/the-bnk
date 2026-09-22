import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { randomBytes, createHash } from "crypto"

interface IdentityVerificationRequest {
  ssn?: string
  accountNumber?: string
  isAuthorizedUser?: boolean
  recoveryType: "username" | "password"
}

export async function POST(request: NextRequest) {
  try {
    const body: IdentityVerificationRequest = await request.json()
    const { ssn, accountNumber, recoveryType } = body
    if ((!ssn && !accountNumber) || !["username", "password"].includes(recoveryType)) {
      return NextResponse.json({ error: "Invalid verification request" }, { status: 400 })
    }
    if (ssn && ssn.length < 5) return NextResponse.json({ error: "Invalid SSN or Tax ID" }, { status: 400 })
    if (accountNumber && accountNumber.length < 8) return NextResponse.json({ error: "Invalid account number" }, { status: 400 })

    const user = accountNumber
      ? await prisma.user.findFirst({ where: { accounts: { some: { accountNumber } } }, select: { id: true, email: true, bnkTag: true } })
      : ssn
        ? await prisma.user.findFirst({ where: { ssnLast4: ssn.slice(-4) }, select: { id: true, email: true, bnkTag: true } })
        : null

    if (!user) return NextResponse.json({ error: "Identity verification failed. Please check your information." }, { status: 404 })

    const token = randomBytes(32).toString("hex")
    const tokenHash = createHash("sha256").update(token).digest("hex")
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    const recoveryModel = (prisma as unknown as { recoverySession?: { create: (args: unknown) => Promise<unknown> } }).recoverySession
    if (recoveryModel) {
      await recoveryModel.create({ data: { userId: user.id, recoveryType, recoveryToken: tokenHash, expiresAt } })
    }

    return NextResponse.json({ success: true, username: user.bnkTag, email: user.email, recoveryToken: token, message: "Identity verified successfully" })
  } catch (error) {
    console.error("Identity verification error", error)
    return NextResponse.json({ error: "Identity verification failed. Please try again." }, { status: 500 })
  }
}
