import { deleteTokenCookie, revokeAllUserSessions, getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) await revokeAllUserSessions(user.id);

    // Clear both session namespaces so the shared logout control works safely
    // whether it is used from the customer application or admin console.
    deleteTokenCookie('access_token');
    deleteTokenCookie('refresh_token');
    deleteTokenCookie('admin_access_token');
    deleteTokenCookie('admin_refresh_token');

    return successResponse({ loggedOut: true });
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}
