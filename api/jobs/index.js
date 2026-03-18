import { withAuth, checkPermission } from '../../lib/middleware';
import { JobService } from '../../lib/services/job';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (!checkPermission(authReq.user, 'can_view_jobs')) {
    res.status(403).json({ success: false, data: null, error: 'Permission denied' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const status = req.query.status;
      const platform = req.query.platform;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await JobService.list({ status, platform, page, limit });
      res.status(200).json({
        success: true,
        data: result.jobs,
        error: null,
        pagination: { page, limit, total: result.total, hasMore: result.hasMore },
      });
    } catch (error) {
      console.error('Jobs list error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  if (req.method === 'POST') {
    if (authReq.user.role !== 'admin') {
      res.status(403).json({ success: false, data: null, error: 'Admin access required' });
      return;
    }

    try {
      const job = await JobService.create(req.body);
      res.status(201).json({ success: true, data: job, error: null });
    } catch (error) {
      console.error('Job create error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
}