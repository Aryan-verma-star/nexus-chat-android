import { withAuth } from '../../lib/middleware';
import { MessageService } from '../../lib/services/message';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  try {
    const { message_id, emoji } = req.body;

    if (!message_id || !emoji) {
      res.status(400).json({ success: false, data: null, error: 'message_id and emoji required' });
      return;
    }

    if (req.method === 'POST') {
      await MessageService.addReaction(message_id, authReq.user.id, emoji);
      res.status(201).json({ success: true, data: { message: 'Reaction added' }, error: null });
      return;
    }

    if (req.method === 'DELETE') {
      await MessageService.removeReaction(message_id, authReq.user.id, emoji);
      res.status(200).json({ success: true, data: { message: 'Reaction removed' }, error: null });
      return;
    }

    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}