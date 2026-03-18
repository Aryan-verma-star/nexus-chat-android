import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../lib/middleware';
import { ChatService } from '../../lib/services/chat.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  const { id } = req.query;
  const conversationId = Array.isArray(id) ? id[0] : id;

  try {
    const isMember = await ChatService.isMember(conversationId, authReq.user.id);
    if (!isMember) {
      res.status(403).json({ success: false, data: null, error: 'Not a member' });
      return;
    }

    if (req.method === 'GET') {
      const members = await ChatService.getMembers(conversationId);
      res.status(200).json({ success: true, data: members, error: null });
      return;
    }

    if (req.method === 'POST') {
      const { user_id, role } = req.body;

      if (!user_id) {
        res.status(400).json({ success: false, data: null, error: 'user_id required' });
        return;
      }

      await ChatService.addMember(conversationId, user_id, role);
      res.status(201).json({ success: true, data: { message: 'Member added' }, error: null });
      return;
    }

    if (req.method === 'DELETE') {
      const { user_id } = req.body;
      const targetUserId = user_id || authReq.user.id;

      if (user_id && authReq.user.role !== 'admin') {
        const members = await ChatService.getMembers(conversationId);
        const member = members.find(m => m.user_id === authReq.user.id);
        if (!member || member.role !== 'admin') {
          res.status(403).json({ success: false, data: null, error: 'Admin access required' });
          return;
        }
      }

      await ChatService.removeMember(conversationId, targetUserId);
      res.status(200).json({ success: true, data: { message: 'Member removed' }, error: null });
      return;
    }

    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Members error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
