import { withAuth, withAdmin } from '../../lib/middleware';
import { ChatService } from '../../lib/services/chat';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  const { id } = req.query;
  const conversationId = Array.isArray(id) ? id[0] : id;

  try {
    const isMember = await ChatService.isMember(conversationId, authReq.user.id);
    const isAdmin = authReq.user.role === 'admin';

    if (!isMember && !isAdmin) {
      res.status(403).json({ success: false, data: null, error: 'Not a member of this conversation' });
      return;
    }

    if (req.method === 'GET') {
      const conversation = await ChatService.getById(conversationId);
      res.status(200).json({ success: true, data: conversation, error: null });
      return;
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { name, description, avatar_url } = req.body;
      const conversation = await ChatService.updateConversation(conversationId, {
        name,
        description,
        avatar_url,
      });
      res.status(200).json({ success: true, data: conversation, error: null });
      return;
    }

    if (req.method === 'DELETE') {
      if (authReq.user.role !== 'admin') {
        res.status(403).json({ success: false, data: null, error: 'Admin access required' });
        return;
      }
      await ChatService.deleteConversation(conversationId);
      res.status(200).json({ success: true, data: { message: 'Conversation deleted' }, error: null });
      return;
    }

    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
  } catch (error) {
    console.error('Conversation error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}