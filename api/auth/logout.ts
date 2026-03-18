import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, logActivity } from '../../lib/middleware';
import { UserService } from '../../lib/services/user.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    await UserService.setOnlineStatus(authReq.user.id, false);
    await logActivity(authReq.user.id, 'user.logout', {}, req.headers['x-forwarded-for'] as string);

    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' },
      error: null,
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, data: null, error: error.message || 'Internal server error' });
  }
}
