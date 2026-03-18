import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth } from '../../lib/middleware';
import { FileService } from '../../lib/services/file.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const path = req.query.path as string;

    if (!path) {
      res.status(400).json({ success: false, data: null, error: 'path required' });
      return;
    }

    const signedUrl = await FileService.getDownloadUrl(path);
    res.status(200).json({ success: true, data: { url: signedUrl }, error: null });
  } catch (error: any) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
