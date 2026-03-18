import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAdmin } from '../../lib/middleware';
import { getAdminClient } from '../../lib/supabase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAdmin(req, res);
  if (!authReq) return;

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const adminClient = getAdminClient();

    const { data: logs, count } = await adminClient
      .from('activity_logs')
      .select('*, profile:profiles(id, display_name, username, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    res.status(200).json({
      success: true,
      data: logs || [],
      error: null,
      pagination: { page, limit, total: count || 0, hasMore: offset + limit < (count || 0) },
    });
  } catch (error: any) {
    console.error('Logs error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
