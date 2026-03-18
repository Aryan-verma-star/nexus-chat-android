import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../lib/middleware';
import { HFService } from '../../lib/services/hf.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;

  const secretKey = req.headers['x-secret-key'] as string;
  const expectedSecret = process.env.NEXUS_SECRET_KEY;

  if (!secretKey || secretKey !== expectedSecret) {
    res.status(401).json({ success: false, data: null, error: 'Invalid secret key' });
    return;
  }

  try {
    if (req.method === 'POST') {
      const { type } = req.body;

      if (type === 'init') {
        await HFService.createDatasetRepo();
        res.status(200).json({ success: true, data: { message: 'Dataset repo created' }, error: null });
        return;
      }

      if (type === 'messages' || type === 'all') {
        const result = await HFService.syncMessages();
        if (type === 'all') {
          await HFService.syncJobs();
        }
        res.status(200).json({ success: true, data: result, error: null });
        return;
      }

      if (type === 'jobs') {
        const result = await HFService.syncJobs();
        res.status(200).json({ success: true, data: result, error: null });
        return;
      }

      res.status(400).json({ success: false, data: null, error: 'Invalid type' });
      return;
    }

    if (req.method === 'GET') {
      const syncInfo = await HFService.getLastSyncInfo();
      res.status(200).json({ success: true, data: syncInfo, error: null });
      return;
    }

    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
  } catch (error: any) {
    console.error('HF sync error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
