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
    const adminClient = getAdminClient();

    const { count: total_users } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    const { count: online_users } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_online', true);

    const { count: total_conversations } = await adminClient
      .from('conversations')
      .select('id', { count: 'exact', head: true });

    const { count: total_messages } = await adminClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: messages_today } = await adminClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
      .eq('is_deleted', false);

    const { count: total_jobs } = await adminClient
      .from('jobs')
      .select('id', { count: 'exact', head: true });

    const { data: jobs_by_status } = await adminClient
      .from('jobs')
      .select('status');

    const statusBreakdown = {
      new: 0,
      claimed: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const job of jobs_by_status || []) {
      if (job.status in statusBreakdown) {
        statusBreakdown[job.status]++;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        total_users: total_users || 0,
        online_users: online_users || 0,
        total_conversations: total_conversations || 0,
        total_messages: total_messages || 0,
        messages_today: messages_today || 0,
        total_jobs: total_jobs || 0,
        jobs_by_status: statusBreakdown,
        server_time: new Date().toISOString(),
      },
      error: null,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}