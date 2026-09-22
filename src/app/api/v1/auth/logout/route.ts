import { deleteTokenCookie, getTokenFromCookie, verifyAccessToken, revokeSession, logAudit } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST() {
  try {
    const token = getTokenFromCookie('access_token');
    const payload = token ? await verifyAccessToken(token) : null;
    if (payload?.sid && payload.sub) {
      await revokeSession(payload.sid);
      await logAudit({ actorId: payload.sub, actorType: 'user', action: 'LOGOUT', entityType: 'user_sessions', entityId: payload.sid });
    }
    deleteTokenCookie('access_token');
    deleteTokenCookie('refresh_token');
    return successResponse({ loggedOut: true });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}
