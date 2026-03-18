import { getAdminClient } from 'supabase-admin';
import { nanoid } from 'nanoid';

export const ChatService = {
  async listForUser(userId) {
    const adminClient = getAdminClient();

    const { data: memberData, error: memberError } = await adminClient
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId);

    if (memberError) throw memberError;
    if (!memberData || memberData.length === 0) return [];

    const conversationIds = memberData.map(m => m.conversation_id);

    const { data: conversations, error: convError } = await adminClient
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false });

    if (convError) throw convError;

    const { data: membersData, error: membersError } = await adminClient
      .from('conversation_members')
      .select('*, profile:profiles(*)')
      .in('conversation_id', conversationIds);

    if (membersError) throw membersError;

    const membersByConv = {};
    for (const m of membersData || []) {
      if (!membersByConv[m.conversation_id]) {
        membersByConv[m.conversation_id] = [];
      }
      membersByConv[m.conversation_id].push({
        id: m.id,
        conversation_id: m.conversation_id,
        user_id: m.user_id,
        role: m.role,
        notifications_muted: m.notifications_muted,
        joined_at: m.joined_at,
        last_read_at: m.last_read_at,
        profile: m.profile,
      });
    }

    const result = [];
    for (const conv of conversations || []) {
      const { data: unreadData } = await adminClient.rpc('get_unread_count', {
        p_conversation_id: conv.id,
        p_user_id: userId,
      });

      result.push({
        ...conv,
        members: membersByConv[conv.id] || [],
        unread_count: unreadData || 0,
      });
    }

    return result;
  },

  async getById(id) {
    const adminClient = getAdminClient();

    const { data: conv, error } = await adminClient
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    const { data: members, error: membersError } = await adminClient
      .from('conversation_members')
      .select('*, profile:profiles(*)')
      .eq('conversation_id', id);

    if (membersError) throw membersError;

    return {
      ...conv,
      members: members?.map(m => ({
        id: m.id,
        conversation_id: m.conversation_id,
        user_id: m.user_id,
        role: m.role,
        notifications_muted: m.notifications_muted,
        joined_at: m.joined_at,
        last_read_at: m.last_read_at,
        profile: m.profile,
      })) || [],
    };
  },

  async createDirect(userId1, userId2) {
    const adminClient = getAdminClient();

    const { data: existing } = await adminClient
      .from('conversation_members')
      .select('conversation_id, conversations(*)')
      .eq('user_id', userId1);

    if (existing) {
      for (const item of existing) {
        const { data: otherMembers } = await adminClient
          .from('conversation_members')
          .select('user_id')
          .eq('conversation_id', item.conversation_id)
          .eq('user_id', userId2)
          .single();

        if (otherMembers) {
          return await this.getById(item.conversation_id);
        }
      }
    }

    const { data: conv, error } = await adminClient
      .from('conversations')
      .insert({
        type: 'direct',
        created_by: userId1,
      })
      .select()
      .single();

    if (error) throw error;

    await adminClient.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: userId1, role: 'admin' },
      { conversation_id: conv.id, user_id: userId2, role: 'admin' },
    ]);

    return await this.getById(conv.id);
  },

  async createGroup(params) {
    const adminClient = getAdminClient();

    const { data: conv, error } = await adminClient
      .from('conversations')
      .insert({
        type: 'group',
        name: params.name,
        description: params.description || null,
        avatar_url: params.avatar_url || null,
        created_by: params.created_by,
      })
      .select()
      .single();

    if (error) throw error;

    const members = [
      { conversation_id: conv.id, user_id: params.created_by, role: 'admin' },
      ...params.member_ids.map(id => ({
        conversation_id: conv.id,
        user_id: id,
        role: 'member',
      })),
    ];

    await adminClient.from('conversation_members').insert(members);

    await adminClient.from('messages').insert({
      conversation_id: conv.id,
      sender_id: params.created_by,
      content: `Group "${params.name}" created`,
      type: 'system',
    });

    return await this.getById(conv.id);
  },

  async addMember(conversationId, userId, role) {
    const adminClient = getAdminClient();
    const { error } = await adminClient.from('conversation_members').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: role || 'member',
    });

    if (error) throw error;
  },

  async removeMember(conversationId, userId) {
    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async getMembers(conversationId) {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('conversation_members')
      .select('*, profile:profiles(*)')
      .eq('conversation_id', conversationId);

    if (error) throw error;

    return (data || []).map(m => ({
      id: m.id,
      conversation_id: m.conversation_id,
      user_id: m.user_id,
      role: m.role,
      notifications_muted: m.notifications_muted,
      joined_at: m.joined_at,
      last_read_at: m.last_read_at,
      profile: m.profile,
    }));
  },

  async isMember(conversationId, userId) {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    return !!data && !error;
  },

  async updateConversation(id, updates) {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteConversation(id) {
    const adminClient = getAdminClient();
    const { error } = await adminClient.from('conversations').delete().eq('id', id);
    if (error) throw error;
  },
};