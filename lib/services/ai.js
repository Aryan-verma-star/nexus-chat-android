import OpenAI from 'openai';
import { getAdminClient } from 'supabase-admin';
import { JobService } from './job';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const AIService = {
  async summarizeConversation(conversationId, hoursBack = 24) {
    const adminClient = getAdminClient();

    const fromDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const toDate = new Date().toISOString();

    const { data: messages, error } = await adminClient
      .from('messages')
      .select('*, sender:profiles(display_name)')
      .eq('conversation_id', conversationId)
      .gte('created_at', fromDate)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const transcript = (messages || [])
      .filter(m => m.type === 'text' && m.content)
      .map(m => `[${m.sender?.display_name || 'Unknown'}]: ${m.content}`)
      .join('\n');

    if (!transcript) {
      return {
        id: '',
        conversation_id: conversationId,
        summary: 'No messages in this time period.',
        message_count: 0,
        from_date: fromDate,
        to_date: toDate,
        model: 'gpt-4o-mini',
        created_at: new Date().toISOString(),
      };
    }

    const systemPrompt = `You are a helpful AI assistant that summarizes chat conversations. 
Provide a concise summary covering:
- Main topics discussed
- Key decisions made
- Action items or tasks mentioned
- Resources shared
- Deadlines mentioned
Use bullet points. Keep it brief but informative.`;

    const userPrompt = `Summarize this conversation:\n\n${transcript}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const summary = completion.choices[0]?.message?.content || 'No summary available.';

    const { data: savedSummary, error: saveError } = await adminClient
      .from('ai_summaries')
      .insert({
        conversation_id: conversationId,
        summary,
        message_count: messages?.length || 0,
        from_date: fromDate,
        to_date: toDate,
        model: 'gpt-4o-mini',
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return savedSummary;
  },

  async summarizeAllChats(hoursBack = 24) {
    const adminClient = getAdminClient();

    const { data: conversations } = await adminClient
      .from('conversations')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(50);

    const summaries = [];

    for (const conv of conversations || []) {
      try {
        const summary = await this.summarizeConversation(conv.id, hoursBack);
        summaries.push(summary);
      } catch (err) {
        console.error(`Failed to summarize conversation ${conv.id}:`, err);
      }
    }

    return summaries;
  },

  async readAndAnalyzeMessages(params) {
    const adminClient = getAdminClient();

    let query = adminClient
      .from('messages')
      .select('*, sender:profiles(display_name), conversation:conversations(id, name, type)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(params.limit || 500);

    if (params.conversationId) {
      query = query.eq('conversation_id', params.conversationId);
    }

    const { data: messages, error } = await query;

    if (error) throw error;

    const transcript = (messages || [])
      .map(m => `[${m.conversation?.name || 'Direct'}] ${m.sender?.display_name || 'Unknown'}: ${m.content || '[file]'}`)
      .join('\n');

    const systemPrompt = params.query
      ? `You are analyzing chat messages. Answer the user's question based on the provided messages.`
      : `You are analyzing chat messages. Provide insights about:
- Main topics being discussed
- Overall sentiment
- Activity levels
- Any patterns or notable behavior
Be concise and informative.`;

    const userPrompt = params.query
      ? `Question: ${params.query}\n\nMessages:\n${transcript}`
      : `Analyze these messages and provide insights:\n${transcript}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    return completion.choices[0]?.message?.content || 'No analysis available.';
  },

  async processJobAutonomously(jobId, adminUserId) {
    const adminClient = getAdminClient();

    const job = await JobService.getById(jobId);

    const { data: task, error: taskError } = await adminClient
      .from('ai_agent_tasks')
      .insert({
        job_id: jobId,
        task_type: 'process_job',
        input_data: {
          job_title: job.title,
          job_description: job.description,
          requirements: job.requirements,
          budget: job.budget_amount,
          client_name: job.client_name,
        },
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (taskError) throw taskError;

    try {
      await JobService.claim(jobId, adminUserId);

      const systemPrompt = `You are a skilled freelancer. Given a job description, create a professional deliverable response.
Include:
- Approach outline
- Estimated timeline
- Key deliverables
- A professional message to the client
Make it look like a real human freelancer wrote it. Be specific and practical.`;

      const userPrompt = `Job Title: ${job.title}
Description: ${job.description || 'No description'}
Requirements: ${job.requirements?.join(', ') || 'None specified'}
Budget: ${job.budget_amount} ${job.budget_currency}
Client: ${job.client_name || 'Unknown'}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const result = completion.choices[0]?.message?.content || 'No result generated.';

      await adminClient
        .from('ai_agent_tasks')
        .update({
          status: 'completed',
          output_data: { result },
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      return {
        task_id: task.id,
        job_id: jobId,
        result,
        status: 'completed',
      };
    } catch (err) {
      await adminClient
        .from('ai_agent_tasks')
        .update({
          status: 'failed',
          error: err.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      return {
        task_id: task.id,
        job_id: jobId,
        error: err.message,
        status: 'failed',
      };
    }
  },

  async getAgentStatus() {
    const adminClient = getAdminClient();

    const { data: tasks } = await adminClient
      .from('ai_agent_tasks')
      .select('*')
      .order('created_at', { descending: true })
      .limit(20);

    const { data: summaries } = await adminClient
      .from('ai_summaries')
      .select('*')
      .order('created_at', { descending: true })
      .limit(10);

    const counts = {
      pending: tasks?.filter(t => t.status === 'pending').length || 0,
      processing: tasks?.filter(t => t.status === 'processing').length || 0,
      completed: tasks?.filter(t => t.status === 'completed').length || 0,
      failed: tasks?.filter(t => t.status === 'failed').length || 0,
    };

    return {
      counts,
      recent_tasks: tasks || [],
      recent_summaries: summaries || [],
      last_check: new Date().toISOString(),
    };
  },
};