import { withAdmin } from '../../lib/middleware';
import { getAdminClient } from '../../lib/supabase-admin';

export default async function(req, res) {
  const authReq = await withAdmin(req, res);
  if (!authReq) return;

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
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
  } catch (error) {
    console.error('Logs error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}