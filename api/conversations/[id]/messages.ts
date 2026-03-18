import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, checkPermission } from '../../lib/middleware';
import { ChatService } from '../../lib/services/chat.service';
import { MessageService } from '../../lib/services/message.service';

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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await MessageService.list(conversationId, { page, limit });
      res.status(200).json({
        success: true,
        data: result.messages,
        error: null,
        pagination: {
          page,
          limit,
          total: result.total,
          hasMore: result.hasMore,
        },
      });
      return;
    }

    if (req.method === 'POST') {
      if (!checkPermission(authReq.user, 'can_send_messages')) {
        res.status(403).json({ success: false, data: null, error: 'Permission denied' });
        return;
      }

      const { content, type, file_url, file_name, file_size, file_type, reply_to } = req.body;

      if (!content && !file_url) {
        res.status(400).json({ success: false, data: null, error: 'content or file_url required' });
        return;
      }

      const message = await MessageService.send({
        conversation_id: conversationId,
        sender_id: authReq.user.id,
        content,
        type: type || 'text',
        file_url,
        file_name,
        file_size,
        file_type,
        reply_to,
      });

      res.status(201).json({ success: true, data: message, error: null });
      return;
    }

    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Messages error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
