import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdmin } from '../../lib/middleware';
import { AIService } from '../../lib/services/ai.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAdmin(req, res);
  if (!authReq) return;

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const { conversation_id, hours_back, all } = req.body;

    if (all) {
      const summaries = await AIService.summarizeAllChats(hours_back || 24);
      res.status(200).json({ success: true, data: summaries, error: null });
      return;
    }

    if (!conversation_id) {
      res.status(400).json({ success: false, data: null, error: 'conversation_id required' });
      return;
    }

    const summary = await AIService.summarizeConversation(conversation_id, hours_back || 24);
    res.status(201).json({ success: true, data: summary, error: null });
  } catch (error: any) {
    console.error('Summarize error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
