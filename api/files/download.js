import { withAuth } from '../../lib/middleware';
import { FileService } from '../../lib/services/file';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const path = req.query.path;

    if (!path) {
      res.status(400).json({ success: false, data: null, error: 'path required' });
      return;
    }

    const signedUrl = await FileService.getDownloadUrl(path);
    res.status(200).json({ success: true, data: { url: signedUrl }, error: null });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}