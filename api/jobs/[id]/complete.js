import { withAuth, logActivity } from '../../lib/middleware';
import { JobService } from '../../lib/services/job';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  const { id } = req.query;
  const jobId = Array.isArray(id) ? id[0] : id;

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const job = await JobService.complete(jobId, authReq.user.id);
    await logActivity(authReq.user.id, 'job.complete', { job_id: jobId });
    res.status(200).json({ success: true, data: job, error: null });
  } catch (error) {
    console.error('Job complete error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}