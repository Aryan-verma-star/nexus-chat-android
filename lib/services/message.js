import { getAdminClient } from 'supabase-admin';
import { NotificationService } from './notification';

export const MessageService = {
  async list(conversationId, params = {}) {
    const adminClient = getAdminClient();
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const { data: totalData } = await adminClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false);

    const total = totalData?.length || 0;

    const { data: messages, error } = await adminClient
      .from('messages')
      .select('*, sender:profiles(*), reply_message:messages!reply_to(*, sender:profiles(display_name))')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    let messagesWithReactions = [];
    for (const msg of messages || []) {
      const { data: reactions } = await adminClient
        .from('message_reactions')
        .select('*, profile:profiles(*)')
        .eq('message_id', msg.id);

      messagesWithReactions.push({
        ...msg,
        sender: msg.sender,
        reply_message: msg.reply_message ? {
          ...msg.reply_message,
          sender: msg.reply_message.sender,
        } : undefined,
        reactions: reactions?.map(r => ({
          ...r,
          profile: r.profile,
        })) || [],
      });
    }

    messagesWithReactions.reverse();

    return {
      messages: messagesWithReactions,
      total,
      hasMore: offset + limit < total,
    };
  },

  async send(params) {
    const adminClient = getAdminClient();

    const { data: message, error } = await adminClient
      .from('messages')
      .insert({
        conversation_id: params.conversation_id,
        sender_id: params.sender_id,
        content: params.content || null,
        type: params.type || 'text',
        file_url: params.file_url || null,
        file_name: params.file_name || null,
        file_size: params.file_size || null,
        file_type: params.file_type || null,
        reply_to: params.reply_to || null,
        metadata: params.metadata || {},
      })
      .select('*, sender:profiles(*)')
      .single();

    if (error) throw error;

    const { data: sender } = await adminClient
      .from('profiles')
      .select('display_name')
      .eq('id', params.sender_id)
      .single();

    const { data: otherMembers } = await adminClient
      .from('conversation_members')
      .select('user_id, notifications_muted')
      .eq('conversation_id', params.conversation_id)
      .neq('user_id', params.sender_id);

    const notifications = (otherMembers || [])
      .filter(m => !m.notifications_muted)
      .map(m => ({
        user_id: m.user_id,
        type: 'new_message',
        title: sender?.display_name || 'New message',
        body: params.content ? params.content.substring(0, 100) : 'Sent a file',
        data: {
          conversation_id: params.conversation_id,
          message_id: message.id,
        },
      }));

    if (notifications.length > 0) {
      await adminClient.from('notifications').insert(notifications);
    }

    return {
      ...message,
      sender: message.sender,
    };
  },

  async markAsRead(conversationId, userId) {
    const adminClient = getAdminClient();

    const { data: member } = await adminClient
      .from('conversation_members')
      .select('last_read_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!member) return;

    const lastReadAt = member.last_read_at || new Date().toISOString();

    await adminClient
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    const { data: unreadMessages } = await adminClient
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .gt('created_at', lastReadAt);

    if (unreadMessages && unreadMessages.length > 0) {
      const reads = unreadMessages.map(m => ({
        message_id: m.id,
        user_id: userId,
      }));

      for (const read of reads) {
        await adminClient.from('message_reads').upsert(read, {
          onConflict: 'message_id,user_id',
        });
      }
    }
  },

  async delete(messageId, userId) {
    const adminClient = getAdminClient();

    const { data: message } = await adminClient
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (!message || message.sender_id !== userId) {
      throw new Error('Not authorized to delete this message');
    }

    const { error } = await adminClient
      .from('messages')
      .update({
        is_deleted: true,
        content: null,
        file_url: null,
      })
      .eq('id', messageId);

    if (error) throw error;
  },

  async edit(messageId, userId, newContent) {
    const adminClient = getAdminClient();

    const { data: message } = await adminClient
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single();

    if (!message || message.sender_id !== userId) {
      throw new Error('Not authorized to edit this message');
    }

    const { data: updated, error } = await adminClient
      .from('messages')
      .update({
        content: newContent,
        is_edited: true,
      })
      .eq('id', messageId)
      .select('*, sender:profiles(*)')
      .single();

    if (error) throw error;

    return {
      ...updated,
      sender: updated.sender,
    };
  },

  async addReaction(messageId, userId, emoji) {
    const adminClient = getAdminClient();
    const { error } = await adminClient.from('message_reactions').upsert({
      message_id: messageId,
      user_id: userId,
      emoji,
    }, {
      onConflict: 'message_id,user_id,emoji',
    });

    if (error) throw error;
  },

  async removeReaction(messageId, userId, emoji) {
    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);

    if (error) throw error;
  },

  async search(query, userId, limit = 50) {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient.rpc('search_messages', {
      p_query: query,
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) throw error;
    return data || [];
  },

  async getAllMessages(params) {
    const adminClient = getAdminClient();
    let query = adminClient
      .from('messages')
      .select('*, sender:profiles(id, display_name, username, avatar_url), conversation:conversations(id, name, type)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(params.limit || 100);

    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 100) - 1);
    }

    if (params.conversationId) {
      query = query.eq('conversation_id', params.conversationId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },
};