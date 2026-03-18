import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../lib/middleware';
import { NotificationService } from '../../lib/services/notification.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const { notification_ids, mark_all } = req.body;

    if (mark_all) {
      await NotificationService.markAllAsRead(authReq.user.id);
    } else if (notification_ids && Array.isArray(notification_ids)) {
      await NotificationService.markAsRead(notification_ids, authReq.user.id);
    } else {
      res.status(400).json({ success: false, data: null, error: 'notification_ids or mark_all required' });
      return;
    }

    res.status(200).json({ success: true, data: { message: 'Marked as read' }, error: null });
  } catch (error: any) {
    console.error('Notification read error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
