import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, checkPermission } from '../../lib/middleware';
import { JobService } from '../../lib/services/job.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (!checkPermission(authReq.user, 'can_view_jobs')) {
    res.status(403).json({ success: false, data: null, error: 'Permission denied' });
    return;
  }

  const { id } = req.query;
  const jobId = Array.isArray(id) ? id[0] : id;

  if (req.method === 'GET') {
    try {
      const comments = await JobService.getComments(jobId);
      res.status(200).json({ success: true, data: comments, error: null });
    } catch (error: any) {
      console.error('Comments list error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { content } = req.body;
      if (!content) {
        res.status(400).json({ success: false, data: null, error: 'content required' });
        return;
      }
      const comment = await JobService.addComment(jobId, authReq.user.id, content);
      res.status(201).json({ success: true, data: comment, error: null });
    } catch (error: any) {
      console.error('Comment create error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
}
