import { deleteTokenCookie, revokeAllUserSessions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (userId) await revokeAllUserSessions(userId);
    deleteTokenCookie('access_token');
    deleteTokenCookie('refresh_token');
    return successResponse({ loggedOut: true });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}