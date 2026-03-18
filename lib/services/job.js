import { getAdminClient } from 'supabase-admin';

export const JobService = {
  async list(params) {
    const adminClient = getAdminClient();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let query = adminClient
      .from('jobs')
      .select('*, claimer:profiles(*)', { count: 'exact' });

    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.platform) {
      query = query.eq('platform', params.platform);
    }

    const { data: jobs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      jobs: (jobs || []).map(j => ({
        ...j,
        claimer: j.claimer,
      })),
      total: count || 0,
      hasMore: offset + limit < (count || 0),
    };
  },

  async getById(id) {
    const adminClient = getAdminClient();
    const { data: job, error } = await adminClient
      .from('jobs')
      .select('*, claimer:profiles(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return { ...job, claimer: job.claimer };
  },

  async create(params) {
    const adminClient = getAdminClient();

    const { data: job, error } = await adminClient
      .from('jobs')
      .insert({
        platform: params.platform,
        title: params.title,
        description: params.description || null,
        requirements: params.requirements || null,
        budget_amount: params.budget_amount || null,
        budget_currency: params.budget_currency || 'USD',
        deadline: params.deadline || null,
        client_name: params.client_name || null,
        client_info: params.client_info || {},
        external_id: params.external_id || null,
        external_url: params.external_url || null,
        attachments: params.attachments || [],
        raw_data: params.raw_data || {},
      })
      .select()
      .single();

    if (error) throw error;

    const { data: users } = await adminClient
      .from('profiles')
      .select('id, permissions')
      .eq('is_active', true);

    const notifications = (users || [])
      .filter(u => u.permissions?.can_view_jobs)
      .map(u => ({
        user_id: u.id,
        type: 'new_job',
        title: `New ${params.platform} Job`,
        body: params.title,
        data: { job_id: job.id },
      }));

    if (notifications.length > 0) {
      await adminClient.from('notifications').insert(notifications);
    }

    return job;
  },

  async claim(jobId, userId) {
    const adminClient = getAdminClient();

    const { data: job } = await adminClient
      .from('jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    if (!job || job.status !== 'new') {
      throw new Error('Job is no longer available for claiming');
    }

    const { data: claimer } = await adminClient
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single();

    const { data: updatedJob, error } = await adminClient
      .from('jobs')
      .update({
        status: 'claimed',
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('*, claimer:profiles(*)')
      .single();

    if (error) throw error;

    const { data: allUsers } = await adminClient
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .neq('id', userId);

    const notifications = (allUsers || []).map(u => ({
      user_id: u.id,
      type: 'job_claimed',
      title: `Job Claimed by ${claimer?.display_name || 'Someone'}`,
      body: updatedJob.title,
      data: { job_id: jobId, claimed_by: userId },
    }));

    if (notifications.length > 0) {
      await adminClient.from('notifications').insert(notifications);
    }

    return updatedJob;
  },

  async complete(jobId, userId) {
    const adminClient = getAdminClient();

    const { data: job } = await adminClient
      .from('jobs')
      .select('claimed_by')
      .eq('id', jobId)
      .single();

    if (!job || job.claimed_by !== userId) {
      throw new Error('Only the claimer can mark this job as completed');
    }

    const { data: updatedJob, error } = await adminClient
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('*, claimer:profiles(*)')
      .single();

    if (error) throw error;

    const { data: allUsers } = await adminClient
      .from('profiles')
      .select('id')
      .eq('is_active', true);

    const notifications = (allUsers || []).map(u => ({
      user_id: u.id,
      type: 'job_completed',
      title: 'Job Completed',
      body: updatedJob.title,
      data: { job_id: jobId },
    }));

    if (notifications.length > 0) {
      await adminClient.from('notifications').insert(notifications);
    }

    return updatedJob;
  },

  async unclaim(jobId) {
    const adminClient = getAdminClient();

    const { data: updatedJob, error } = await adminClient
      .from('jobs')
      .update({
        status: 'new',
        claimed_by: null,
        claimed_at: null,
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return updatedJob;
  },

  async addComment(jobId, userId, content) {
    const adminClient = getAdminClient();

    const { data: comment, error } = await adminClient
      .from('job_comments')
      .insert({
        job_id: jobId,
        user_id: userId,
        content,
      })
      .select('*, profile:profiles(*)')
      .single();

    if (error) throw error;
    return { ...comment, profile: comment.profile };
  },

  async getComments(jobId) {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('job_comments')
      .select('*, profile:profiles(*)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(c => ({
      ...c,
      profile: c.profile,
    }));
  },
};