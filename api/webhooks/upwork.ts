import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, logActivity } from '../../lib/middleware';
import { JobService } from '../../lib/services/job.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const secret = req.headers['x-webhook-secret'] as string || req.query.secret as string;
    const expectedSecret = process.env.UPWORK_WEBHOOK_SECRET;

    if (secret !== expectedSecret) {
      res.status(401).json({ success: false, data: null, error: 'Invalid secret' });
      return;
    }

    const payload = req.body;
    const job = await JobService.create({
      platform: 'upwork',
      title: payload.title || payload.job?.title || 'New Upwork Job',
      description: payload.description || payload.job?.description || null,
      requirements: payload.requirements || payload.job?.skills || [],
      budget_amount: payload.budget || payload.job?.budget || null,
      budget_currency: 'USD',
      deadline: payload.deadline || null,
      client_name: payload.client?.name || payload.job?.client?.name || null,
      client_info: payload.client || payload.job?.client || {},
      external_id: payload.job_id || payload.id?.toString() || null,
      external_url: payload.url || payload.job_url || null,
      attachments: payload.attachments || [],
      raw_data: payload,
    });

    await logActivity(null, 'webhook.upwork', { job_id: job.id, job_id_ext: payload.job_id });

    res.status(201).json({ success: true, data: job, error: null });
  } catch (error: any) {
    console.error('Upwork webhook error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
