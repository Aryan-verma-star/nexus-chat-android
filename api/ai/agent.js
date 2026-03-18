import { handleCors } from '../../lib/middleware';
import { AIService } from '../../lib/services/ai';

export default async function(req, res) {
  if (handleCors(req, res)) return;

  const secretKey = req.headers['x-secret-key'];
  const expectedSecret = process.env.NEXUS_SECRET_KEY;

  if (!secretKey || secretKey !== expectedSecret) {
    res.status(401).json({ success: false, data: null, error: 'Invalid secret key' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const { action, ...params } = req.body;

    if (action === 'process_job') {
      const { job_id, admin_user_id } = params;
      if (!job_id || !admin_user_id) {
        res.status(400).json({ success: false, data: null, error: 'job_id and admin_user_id required' });
        return;
      }
      const result = await AIService.processJobAutonomously(job_id, admin_user_id);
      res.status(200).json({ success: true, data: result, error: null });
      return;
    }

    if (action === 'analyze') {
      const result = await AIService.readAndAnalyzeMessages({
        query: params.query,
        conversationId: params.conversation_id,
        limit: params.limit,
      });
      res.status(200).json({ success: true, data: { analysis: result }, error: null });
      return;
    }

    res.status(400).json({ success: false, data: null, error: 'Invalid action' });
  } catch (error) {
    console.error('AI agent error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}