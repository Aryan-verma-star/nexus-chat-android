import { withAuth, logActivity } from '../../lib/middleware';
import { UserService } from '../../lib/services/user';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    await UserService.setOnlineStatus(authReq.user.id, false);
    await logActivity(authReq.user.id, 'user.logout', {}, req.headers['x-forwarded-for']);

    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' },
      error: null,
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, data: null, error: error.message || 'Internal server error' });
  }
}