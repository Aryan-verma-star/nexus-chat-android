import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, checkPermission, logActivity } from '../../lib/middleware';
import { ChatService } from '../../lib/services/chat.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (req.method === 'GET') {
    try {
      const conversations = await ChatService.listForUser(authReq.user.id);
      res.status(200).json({ success: true, data: conversations, error: null });
    } catch (error: any) {
      console.error('Conversations list error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { type, user_id, name, description, avatar_url, member_ids } = req.body;

      if (type === 'direct') {
        if (!user_id) {
          res.status(400).json({ success: false, data: null, error: 'user_id required for direct messages' });
          return;
        }
        const conversation = await ChatService.createDirect(authReq.user.id, user_id);
        res.status(201).json({ success: true, data: conversation, error: null });
        return;
      }

      if (type === 'group') {
        if (!checkPermission(authReq.user, 'can_create_groups')) {
          res.status(403).json({ success: false, data: null, error: 'Permission denied' });
          return;
        }

        if (!name || !member_ids || !Array.isArray(member_ids)) {
          res.status(400).json({ success: false, data: null, error: 'name and member_ids[] required for groups' });
          return;
        }

        const conversation = await ChatService.createGroup({
          name,
          description,
          avatar_url,
          created_by: authReq.user.id,
          member_ids,
        });

        await logActivity(authReq.user.id, 'conversation.create', { conversation_id: conversation.id, type: 'group' });
        res.status(201).json({ success: true, data: conversation, error: null });
        return;
      }

      res.status(400).json({ success: false, data: null, error: 'Invalid conversation type' });
      return;
    } catch (error: any) {
      console.error('Conversation create error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
}
