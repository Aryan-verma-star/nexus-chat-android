import { withAuth } from '../../lib/middleware';
import { NotificationService } from '../../lib/services/notification';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await NotificationService.listForUser(authReq.user.id, { page, limit });
    const unreadCount = await NotificationService.getUnreadCount(authReq.user.id);

    res.status(200).json({
      success: true,
      data: result.notifications,
      error: null,
      pagination: { page, limit, total: result.total, hasMore: result.notifications.length < result.total },
      unread_count: unreadCount,
    });
  } catch (error) {
    console.error('Notifications list error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}