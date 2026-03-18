import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../lib/middleware';
import { UserService } from '../../lib/services/user.service';
import { NotificationService } from '../../lib/services/notification.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const unreadCount = await NotificationService.getUnreadCount(authReq.user.id);

    res.status(200).json({
      success: true,
      data: {
        user: authReq.user,
        unread_notification_count: unreadCount,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Me error:', error);
    res.status(500).json({ success: false, data: null, error: error.message || 'Internal server error' });
  }
}
