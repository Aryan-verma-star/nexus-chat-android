import { getAdminClient } from 'supabase-admin';

export const HFService = {
  async syncMessages() {
    const adminClient = getAdminClient();

    const { data: lastSync } = await adminClient
      .from('hf_sync_log')
      .select('last_synced_id')
      .eq('sync_type', 'messages')
      .eq('status', 'completed')
      .order('created_at', { descending: true })
      .limit(1)
      .single();

    let query = adminClient
      .from('messages')
      .select('*, sender:profiles(username, display_name), conversation:conversations(name, type)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(1000);

    if (lastSync?.last_synced_id) {
      const { data: lastMsg } = await adminClient
        .from('messages')
        .select('created_at')
        .eq('id', lastSync.last_synced_id)
        .single();

      if (lastMsg) {
        query = query.gt('created_at', lastMsg.created_at);
      }
    }

    const { data: messages, error } = await query;

    if (error) throw error;
    if (!messages || messages.length === 0) {
      return { synced: 0, lastId: lastSync?.last_synced_id || null };
    }

    const rows = (messages || []).map(m => ({
      id: m.id,
      conversation_id: m.conversation_id,
      conversation_name: m.conversation?.name || null,
      conversation_type: m.conversation?.type || 'direct',
      sender_id: m.sender_id,
      sender_name: m.sender?.display_name || null,
      sender_username: m.sender?.username || null,
      content: m.content,
      type: m.type,
      file_url: m.file_url,
      file_name: m.file_name,
      created_at: m.created_at,
    }));

    await this.pushToDataset('messages', rows);

    const lastId = messages[messages.length - 1]?.id || null;

    await adminClient.from('hf_sync_log').insert({
      sync_type: 'messages',
      records_synced: messages.length,
      last_synced_id: lastId,
      status: 'completed',
    });

    return { synced: messages.length, lastId };
  },

  async syncJobs() {
    const adminClient = getAdminClient();

    const { data: lastSync } = await adminClient
      .from('hf_sync_log')
      .select('last_synced_id')
      .eq('sync_type', 'jobs')
      .eq('status', 'completed')
      .order('created_at', { descending: true })
      .limit(1)
      .single();

    let query = adminClient
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1000);

    if (lastSync?.last_synced_id) {
      const { data: lastJob } = await adminClient
        .from('jobs')
        .select('created_at')
        .eq('id', lastSync.last_synced_id)
        .single();

      if (lastJob) {
        query = query.gt('created_at', lastJob.created_at);
      }
    }

    const { data: jobs, error } = await query;

    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      return { synced: 0 };
    }

    const rows = (jobs || []).map(j => ({
      id: j.id,
      platform: j.platform,
      external_id: j.external_id,
      title: j.title,
      description: j.description,
      requirements: j.requirements,
      budget_amount: j.budget_amount,
      budget_currency: j.budget_currency,
      status: j.status,
      client_name: j.client_name,
      created_at: j.created_at,
    }));

    await this.pushToDataset('jobs', rows);

    const lastId = jobs[jobs.length - 1]?.id || null;

    await adminClient.from('hf_sync_log').insert({
      sync_type: 'jobs',
      records_synced: jobs.length,
      last_synced_id: lastId,
      status: 'completed',
    });

    return { synced: jobs.length };
  },

  async pushToDataset(split, rows) {
    const token = process.env.HF_TOKEN;
    const repo = process.env.HF_DATASET_REPO;

    if (!token || !repo) {
      throw new Error('HuggingFace credentials not configured');
    }

    const jsonl = rows.map(r => JSON.stringify(r)).join('\n');
    const timestamp = Date.now();
    const filename = `${split}_${timestamp}.jsonl`;

    const response = await fetch(
      `https://huggingface.co/api/datasets/${repo}/upload/main/${split}/${filename}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: jsonl,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HF upload failed: ${response.status} - ${errorText}`);
    }
  },

  async createDatasetRepo() {
    const token = process.env.HF_TOKEN;
    const repo = process.env.HF_DATASET_REPO;

    if (!token || !repo) {
      throw new Error('HuggingFace credentials not configured');
    }

    const [name] = repo.split('/').slice(-1);

    const response = await fetch('https://huggingface.co/api/repos/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        type: 'dataset',
        private: true,
      }),
    });

    if (!response.ok && response.status !== 409) {
      const errorText = await response.text();
      throw new Error(`Failed to create repo: ${response.status} - ${errorText}`);
    }
  },

  async getLastSyncInfo() {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('hf_sync_log')
      .select('*')
      .order('created_at', { descending: true })
      .limit(10);

    if (error) throw error;
    return data || [];
  },
};