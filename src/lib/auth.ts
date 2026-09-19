import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

const accessSecretValue = process.env.JWT_ACCESS_SECRET;
const refreshSecretValue = process.env.JWT_REFRESH_SECRET;
if (process.env.NODE_ENV === 'production' && (!accessSecretValue || accessSecretValue.length < 32)) {
  throw new Error('JWT_ACCESS_SECRET must be configured with at least 32 characters in production');
}
if (process.env.NODE_ENV === 'production' && (!refreshSecretValue || refreshSecretValue.length < 32)) {
  throw new Error('JWT_REFRESH_SECRET must be configured with at least 32 characters in production');
}
const ACCESS_SECRET = new TextEncoder().encode(accessSecretValue || 'dev-access-secret-change-me-in-production-32chars');
const REFRESH_SECRET = new TextEncoder().encode(refreshSecretValue || 'dev-refresh-secret-change-me-in-production-32chars');

const ACCESS_EXPIRY = '15 minutes';
const REFRESH_EXPIRY = '7 days';

export interface TokenPayload {
  sub: string;
  email: string;
  role?: string;
  type: 'access' | 'refresh';
}

export async function signAccessToken(payload: Omit<TokenPayload, 'type'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRY)
    .sign(ACCESS_SECRET);
}

export async function signRefreshToken(payload: Omit<TokenPayload, 'type'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRY)
    .sign(REFRESH_SECRET);
}

export async function verifyToken(token: string, secret: Uint8Array): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  return verifyToken(token, ACCESS_SECRET);
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  return verifyToken(token, REFRESH_SECRET);
}

export function setTokenCookie(name: string, token: string, maxAge: number) {
  const cookieStore = cookies();
  cookieStore.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export async function getCurrentUser() {
  const token = getTokenFromCookie('access_token');
  if (!token) return null;
  const payload = await verifyAccessToken(token);
  if (!payload?.sub || payload.role === 'admin') return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, status: true, firstName: true, lastName: true } });
  if (!user || user.status !== 'active') return null;
  return user;
}

/** Admin authentication is intentionally isolated from the customer cookie. */
export async function getCurrentAdmin() {
  const token = getTokenFromCookie('admin_access_token');
  if (!token) return null;
  const payload = await verifyAccessToken(token);
  if (!payload?.sub || payload.role !== 'admin') return null;
  const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub }, include: { role: true } });
  if (!admin || admin.status !== 'active') return null;
  return admin;
}

export function getTokenFromCookie(name: string): string | undefined {
  const cookieStore = cookies();
  return cookieStore.get(name)?.value;
}

export function deleteTokenCookie(name: string) {
  const cookieStore = cookies();
  cookieStore.set(name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function createUserSession(
  userId: string,
  refreshToken: string,
  ipAddress?: string,
  deviceInfo?: string
) {
  return prisma.userSession.create({
    data: {
      userId,
      refreshTokenHash: refreshToken,
      ipAddress,
      deviceInfo: deviceInfo ? JSON.parse(deviceInfo) : undefined,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

export async function revokeSession(sessionId: string) {
  return prisma.userSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string) {
  return prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logAudit(params: {
  actorId: string;
  actorType: 'user' | 'admin' | 'system';
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.auditLog.create({ data: params });
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);
