import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdmin } from '../../lib/middleware';
import { AIService } from '../../lib/services/ai.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAdmin(req, res);
  if (!authReq) return;

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const status = await AIService.getAgentStatus();
    res.status(200).json({ success: true, data: status, error: null });
  } catch (error: any) {
    console.error('AI status error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
