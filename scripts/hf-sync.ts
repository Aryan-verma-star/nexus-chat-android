import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HF_TOKEN = process.env.HF_TOKEN!;
const HF_DATASET_REPO = process.env.HF_DATASET_REPO!;

async function syncToHuggingFace(type: 'messages' | 'jobs' | 'all') {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log(`Starting ${type} sync to HuggingFace...`);

  if (type === 'messages' || type === 'all') {
    const { data: lastSync } = await supabase
      .from('hf_sync_log')
      .select('last_synced_id')
      .eq('sync_type', 'messages')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let query = supabase
      .from('messages')
      .select('*, sender:profiles(username, display_name), conversation:conversations(name, type)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(1000);

    if (lastSync?.last_synced_id) {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('created_at')
        .eq('id', lastSync.last_synced_id)
        .single();

      if (lastMsg) {
        query = query.gt('created_at', lastMsg.created_at);
      }
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      process.exit(1);
    }

    if (!messages || messages.length === 0) {
      console.log('No new messages to sync');
    } else {
      const rows = messages.map(m => ({
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

      const jsonl = rows.map(r => JSON.stringify(r)).join('\n');
      const timestamp = Date.now();

      const response = await fetch(
        `https://huggingface.co/api/datasets/${HF_DATASET_REPO}/upload/main/messages/messages_${timestamp}.jsonl`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/octet-stream',
          },
          body: jsonl,
        }
      );

      if (!response.ok) {
        console.error('HF upload failed:', response.status, await response.text());
        process.exit(1);
      }

      const lastId = messages[messages.length - 1]?.id || null;

      await supabase.from('hf_sync_log').insert({
        sync_type: 'messages',
        records_synced: messages.length,
        last_synced_id: lastId,
        status: 'completed',
      });

      console.log(`Synced ${messages.length} messages`);
    }
  }

  if (type === 'jobs' || type === 'all') {
    const { data: lastSync } = await supabase
      .from('hf_sync_log')
      .select('last_synced_id')
      .eq('sync_type', 'jobs')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let query = supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1000);

    if (lastSync?.last_synced_id) {
      const { data: lastJob } = await supabase
        .from('jobs')
        .select('created_at')
        .eq('id', lastSync.last_synced_id)
        .single();

      if (lastJob) {
        query = query.gt('created_at', lastJob.created_at);
      }
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Error fetching jobs:', error);
      process.exit(1);
    }

    if (!jobs || jobs.length === 0) {
      console.log('No new jobs to sync');
    } else {
      const rows = jobs.map(j => ({
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

      const jsonl = rows.map(r => JSON.stringify(r)).join('\n');
      const timestamp = Date.now();

      const response = await fetch(
        `https://huggingface.co/api/datasets/${HF_DATASET_REPO}/upload/main/jobs/jobs_${timestamp}.jsonl`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/octet-stream',
          },
          body: jsonl,
        }
      );

      if (!response.ok) {
        console.error('HF upload failed:', response.status, await response.text());
        process.exit(1);
      }

      const lastId = jobs[jobs.length - 1]?.id || null;

      await supabase.from('hf_sync_log').insert({
        sync_type: 'jobs',
        records_synced: jobs.length,
        last_synced_id: lastId,
        status: 'completed',
      });

      console.log(`Synced ${jobs.length} jobs`);
    }
  }

  console.log('Sync complete!');
}

const type = (process.argv[2] as 'messages' | 'jobs' | 'all') || 'all';
syncToHuggingFace(type).catch(console.error);
