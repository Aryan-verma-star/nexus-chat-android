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
    const expectedSecret = process.env.FIVERR_WEBHOOK_SECRET;

    if (secret !== expectedSecret) {
      res.status(401).json({ success: false, data: null, error: 'Invalid secret' });
      return;
    }

    const payload = req.body;
    const job = await JobService.create({
      platform: 'fiverr',
      title: payload.title || payload.order?.title || 'New Fiverr Order',
      description: payload.description || payload.order?.description || null,
      requirements: payload.requirements || [],
      budget_amount: payload.budget || payload.order?.price?.amount || null,
      budget_currency: payload.currency || payload.order?.price?.currency || 'USD',
      deadline: payload.deadline || null,
      client_name: payload.client?.name || payload.buyer_name || null,
      client_info: payload.client || {},
      external_id: payload.order_id || payload.id?.toString() || null,
      external_url: payload.url || payload.order_url || null,
      attachments: payload.attachments || [],
      raw_data: payload,
    });

    await logActivity(null, 'webhook.fiverr', { job_id: job.id, order_id: payload.order_id });

    res.status(201).json({ success: true, data: job, error: null });
  } catch (error: any) {
    console.error('Fiverr webhook error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
