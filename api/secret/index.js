import { handleCors, logActivity } from '../../lib/middleware';
import { getAdminClient } from '../../lib/supabase-admin';
import { UserService } from '../../lib/services/user';
import { ChatService } from '../../lib/services/chat';
import { MessageService } from '../../lib/services/message';
import { JobService } from '../../lib/services/job';
import { NotificationService } from '../../lib/services/notification';
import { AIService } from '../../lib/services/ai';
import { HFService } from '../../lib/services/hf';

const HELP_TEXT = `
╔══════════════════════════════════════════════════════════════╗
║                    NEXUS SECRET TERMINAL                      ║
║                         v1.0.0                                 ║
╚══════════════════════════════════════════════════════════════╝

USERS:
  users.list                                   List all users
  users.create <email> <password> <name>      Create new user
  users.delete <id>                           Delete user
  users.reset_password <id> <password>        Reset user password
  users.deactivate <id>                       Deactivate user
  users.permissions <id> <json>               Update permissions

MESSAGES:
  messages.read [convId] [limit]              Read all messages
  messages.search <query>                    Search messages
  messages.export <convId>                    Export conversation
  messages.delete <msgId>                     Delete message
  messages.stats                              Message statistics

JOBS:
  jobs.list [status]                          List jobs
  jobs.create <json>                          Create job
  jobs.assign <jobId> <userId>               Assign job to user
  jobs.unclaim <jobId>                        Unclaim job

AI:
  ai.summary <convId> [hours]                Summarize conversation
  ai.summary_all [hours]                      Summarize all chats
  ai.analyze [question]                       Analyze all messages
  ai.agent.process <jobId> <adminId>          Process job autonomously
  ai.agent.status                            Agent status

HUGGINGFACE:
  hf.sync [messages|jobs|all]                 Sync to HF
  hf.init                                     Create HF dataset
  hf.status                                   Sync status

NOTIFICATIONS:
  notify.broadcast <title> <body>            Broadcast notification

SYSTEM:
  system.stats                                System statistics
  system.logs [limit]                         Recent logs

Type 'help' to show this message.
`;

export default async function(req, res) {
  if (handleCors(req, res)) return;

  const secretKey = req.headers['x-secret-key'];
  const expectedSecret = process.env.NEXUS_SECRET_KEY;

  if (!secretKey || secretKey !== expectedSecret) {
    res.status(401).json({ success: false, data: null, error: 'Invalid secret key' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const { command, args } = req.body;
    const adminClient = getAdminClient();

    if (!command || command === 'help') {
      res.status(200).json({ success: true, data: { output: HELP_TEXT }, error: null });
      return;
    }

    if (command === 'clear') {
      res.status(200).json({ success: true, data: { output: '\x1b[2J\x1b[H' }, error: null });
      return;
    }

    let output = '';

    if (command === 'users.list') {
      const users = await UserService.list();
      output = users.map(u => {
        const role = u.role === 'admin' ? '★' : '○';
        const status = u.is_online ? '●' : '○';
        const active = u.is_active ? '' : ' [INACTIVE]';
        return `${role} ${status} ${u.display_name} @${u.username}${active}`;
      }).join('\n') || 'No users found.';
    }

    else if (command === 'users.create') {
      const [email, password, ...nameParts] = args;
      if (!email || !password || nameParts.length === 0) {
        output = 'Usage: users.create <email> <password> <name>';
      } else {
        const display_name = nameParts.join(' ');
        const username = email.split('@')[0].toLowerCase();
        const user = await UserService.create({ email, password, username, display_name });
        output = `✓ User created: ${user.id}`;
      }
    }

    else if (command === 'users.delete') {
      const [userId] = args;
      if (!userId) {
        output = 'Usage: users.delete <id>';
      } else {
        await UserService.delete(userId);
        output = `✓ User deleted: ${userId}`;
      }
    }

    else if (command === 'users.reset_password') {
      const [userId, newPassword] = args;
      if (!userId || !newPassword) {
        output = 'Usage: users.reset_password <id> <password>';
      } else {
        await UserService.resetPassword(userId, newPassword);
        output = `✓ Password reset for: ${userId}`;
      }
    }

    else if (command === 'users.deactivate') {
      const [userId] = args;
      if (!userId) {
        output = 'Usage: users.deactivate <id>';
      } else {
        await UserService.deactivate(userId);
        output = `✓ User deactivated: ${userId}`;
      }
    }

    else if (command === 'users.permissions') {
      const [userId, ...jsonParts] = args;
      if (!userId || jsonParts.length === 0) {
        output = 'Usage: users.permissions <id> <json>';
      } else {
        const permissions = JSON.parse(jsonParts.join(' '));
        const user = await UserService.updatePermissions(userId, permissions);
        output = `✓ Permissions updated: ${JSON.stringify(user.permissions, null, 2)}`;
      }
    }

    else if (command === 'messages.read') {
      const [convId, limit] = args;
      const messages = await MessageService.getAllMessages({
        conversationId: convId || undefined,
        limit: limit ? parseInt(limit) : 100,
      });
      output = messages.map(m => {
        const convName = m.conversation?.name || 'Direct';
        const sender = m.sender?.display_name || 'Unknown';
        const content = m.content || '[file]';
        const time = new Date(m.created_at).toLocaleString();
        return `[${time}] [${convName}] ${sender}: ${content}`;
      }).join('\n') || 'No messages found.';
    }

    else if (command === 'messages.search') {
      const query = args.join(' ');
      if (!query) {
        output = 'Usage: messages.search <query>';
      } else {
        const { data: messages } = await adminClient
          .from('messages')
          .select('*, sender:profiles(display_name), conversation:conversations(name)')
          .ilike('content', `%${query}%`)
          .eq('is_deleted', false)
          .limit(50);

        output = (messages || []).map(m => {
          const convName = m.conversation?.name || 'Direct';
          return `[${convName}] ${m.sender?.display_name}: ${m.content}`;
        }).join('\n') || 'No results found.';
      }
    }

    else if (command === 'messages.export') {
      const [convId] = args;
      if (!convId) {
        output = 'Usage: messages.export <conversationId>';
      } else {
        const messages = await MessageService.getAllMessages({ conversationId: convId, limit: 10000 });
        output = JSON.stringify(messages, null, 2);
      }
    }

    else if (command === 'messages.delete') {
      const [msgId] = args;
      if (!msgId) {
        output = 'Usage: messages.delete <messageId>';
      } else {
        await adminClient
          .from('messages')
          .update({ is_deleted: true, content: '[DELETED BY ADMIN]' })
          .eq('id', msgId);
        output = `✓ Message deleted: ${msgId}`;
      }
    }

    else if (command === 'messages.stats') {
      const { count: total } = await adminClient.from('messages').select('id', { count: 'exact', head: true });
      const today = new Date(); today.setHours(0,0,0,0);
      const { count: todayCount } = await adminClient.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString());

      const { data: byUser } = await adminClient
        .from('messages')
        .select('sender_id, profiles(display_name)')
        .limit(1000);

      const userCounts = {};
      for (const m of byUser || []) {
        userCounts[m.sender_id] = (userCounts[m.sender_id] || 0) + 1;
      }

      output = `Total Messages: ${total || 0}\nToday: ${todayCount || 0}\n\nBy User:\n${Object.entries(userCounts).map(([id, count]) => `  ${id.slice(0,8)}: ${count}`).join('\n')}`;
    }

    else if (command === 'jobs.list') {
      const [status] = args;
      const result = await JobService.list({ status: status || undefined, limit: 50 });
      output = result.jobs.map(j => {
        const budget = j.budget_amount ? `$${j.budget_amount}` : '';
        const claimer = j.claimer?.display_name || '';
        return `[${j.platform}] ${j.status} ${budget} - ${j.title} ${claimer ? `(by ${claimer})` : ''}`;
      }).join('\n') || 'No jobs found.';
    }

    else if (command === 'jobs.create') {
      const jsonStr = args.join(' ');
      if (!jsonStr) {
        output = 'Usage: jobs.create <json>';
      } else {
        const jobData = JSON.parse(jsonStr);
        const job = await JobService.create(jobData);
        output = `✓ Job created: ${job.id}`;
      }
    }

    else if (command === 'jobs.assign') {
      const [jobId, userId] = args;
      if (!jobId || !userId) {
        output = 'Usage: jobs.assign <jobId> <userId>';
      } else {
        await adminClient
          .from('jobs')
          .update({ status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString() })
          .eq('id', jobId);
        output = `✓ Job ${jobId} assigned to ${userId}`;
      }
    }

    else if (command === 'jobs.unclaim') {
      const [jobId] = args;
      if (!jobId) {
        output = 'Usage: jobs.unclaim <jobId>';
      } else {
        await JobService.unclaim(jobId);
        output = `✓ Job ${jobId} unclaimed`;
      }
    }

    else if (command === 'ai.summary') {
      const [convId, hours] = args;
      if (!convId) {
        output = 'Usage: ai.summary <conversationId> [hours]';
      } else {
        const summary = await AIService.summarizeConversation(convId, hours ? parseInt(hours) : 24);
        output = summary.summary;
      }
    }

    else if (command === 'ai.summary_all') {
      const [hours] = args;
      const summaries = await AIService.summarizeAllChats(hours ? parseInt(hours) : 24);
      output = summaries.map(s => `Conversation ${s.conversation_id}:\n${s.summary}`).join('\n\n');
    }

    else if (command === 'ai.analyze') {
      const question = args.join(' ') || undefined;
      const result = await AIService.readAndAnalyzeMessages({ query: question, limit: 500 });
      output = result;
    }

    else if (command === 'ai.agent.process') {
      const [jobId, adminUserId] = args;
      if (!jobId || !adminUserId) {
        output = 'Usage: ai.agent.process <jobId> <adminUserId>';
      } else {
        const result = await AIService.processJobAutonomously(jobId, adminUserId);
        output = `Status: ${result.status}\nResult: ${result.result || result.error}`;
      }
    }

    else if (command === 'ai.agent.status') {
      const status = await AIService.getAgentStatus();
      output = `Tasks: ${status.counts.pending} pending, ${status.counts.processing} processing, ${status.counts.completed} completed, ${status.counts.failed} failed`;
    }

    else if (command === 'hf.sync') {
      const [type] = args || ['all'];
      if (type === 'messages') {
        const result = await HFService.syncMessages();
        output = `Synced ${result.synced} messages`;
      } else if (type === 'jobs') {
        const result = await HFService.syncJobs();
        output = `Synced ${result.synced} jobs`;
      } else {
        const msgResult = await HFService.syncMessages();
        const jobResult = await HFService.syncJobs();
        output = `Synced ${msgResult.synced} messages, ${jobResult.synced} jobs`;
      }
    }

    else if (command === 'hf.init') {
      await HFService.createDatasetRepo();
      output = '✓ Dataset repository created';
    }

    else if (command === 'hf.status') {
      const info = await HFService.getLastSyncInfo();
      output = info.map(i => `[${i.sync_type}] ${i.records_synced} records - ${i.status} (${new Date(i.created_at).toLocaleString()})`).join('\n') || 'No sync history';
    }

    else if (command === 'notify.broadcast') {
      const [title, ...bodyParts] = args;
      if (!title) {
        output = 'Usage: notify.broadcast <title> <body>';
      } else {
        await NotificationService.broadcastToAll({
          type: 'admin_announcement',
          title,
          body: bodyParts.join(' '),
        });
        output = `✓ Broadcast sent: ${title}`;
      }
    }

    else if (command === 'system.stats') {
      const { count: users } = await adminClient.from('profiles').select('id', { count: 'exact', head: true });
      const { count: convs } = await adminClient.from('conversations').select('id', { count: 'exact', head: true });
      const { count: msgs } = await adminClient.from('messages').select('id', { count: 'exact', head: true });
      const { count: jobs } = await adminClient.from('jobs').select('id', { count: 'exact', head: true });

      output = `Users: ${users || 0}\nConversations: ${convs || 0}\nMessages: ${msgs || 0}\nJobs: ${jobs || 0}`;
    }

    else if (command === 'system.logs') {
      const [limit] = args;
      const { data: logs } = await adminClient
        .from('activity_logs')
        .select('*, profile:profiles(display_name)')
        .order('created_at', { ascending: false })
        .limit(limit ? parseInt(limit) : 20);

      output = (logs || []).map(l => `[${new Date(l.created_at).toLocaleString()}] ${l.profile?.display_name || 'System'}: ${l.action}`).join('\n');
    }

    else {
      output = `❌ Unknown command: ${command}. Type 'help' for available commands.`;
    }

    res.status(200).json({ success: true, data: { output }, error: null });
  } catch (error) {
    console.error('Secret terminal error:', error);
    res.status(200).json({ success: true, data: { output: `Error: ${error.message}` }, error: null });
  }
}