import { withAuth } from '../../lib/middleware';
import { MessageService } from '../../lib/services/message';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const query = req.query.q;

    if (!query || query.length < 2) {
      res.status(400).json({ success: false, data: null, error: 'Search query must be at least 2 characters' });
      return;
    }

    const limit = parseInt(req.query.limit) || 50;
    const results = await MessageService.search(query, authReq.user.id, limit);

    res.status(200).json({ success: true, data: results, error: null });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}