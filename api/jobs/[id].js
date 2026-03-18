import { withAuth, checkPermission } from '../../lib/middleware';
import { JobService } from '../../lib/services/job';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (!checkPermission(authReq.user, 'can_view_jobs')) {
    res.status(403).json({ success: false, data: null, error: 'Permission denied' });
    return;
  }

  const { id } = req.query;
  const jobId = Array.isArray(id) ? id[0] : id;

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const job = await JobService.getById(jobId);
    const comments = await JobService.getComments(jobId);
    res.status(200).json({ success: true, data: { ...job, comments }, error: null });
  } catch (error) {
    console.error('Job get error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}