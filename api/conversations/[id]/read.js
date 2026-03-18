import { withAuth } from '../../lib/middleware';
import { ChatService } from '../../lib/services/chat';
import { MessageService } from '../../lib/services/message';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  const { id } = req.query;
  const conversationId = Array.isArray(id) ? id[0] : id;

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const isMember = await ChatService.isMember(conversationId, authReq.user.id);
    if (!isMember) {
      res.status(403).json({ success: false, data: null, error: 'Not a member' });
      return;
    }

    await MessageService.markAsRead(conversationId, authReq.user.id);
    res.status(200).json({ success: true, data: { message: 'Marked as read' }, error: null });
  } catch (error) {
    console.error('Read error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}