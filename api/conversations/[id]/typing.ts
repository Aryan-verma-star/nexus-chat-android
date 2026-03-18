import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../lib/middleware';
import { ChatService } from '../../lib/services/chat.service';
import { getAdminClient } from '../../lib/supabase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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

    const { is_typing } = req.body;
    const adminClient = getAdminClient();

    await adminClient.from('typing_indicators').upsert({
      conversation_id: conversationId,
      user_id: authReq.user.id,
      is_typing: Boolean(is_typing),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'conversation_id,user_id',
    });

    res.status(200).json({ success: true, data: { message: 'Typing status updated' }, error: null });
  } catch (error: any) {
    console.error('Typing error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
