import { getAdminClient } from '../lib/supabase-admin';
import { Conversation, ConversationMember, Profile } from '../lib/types';
import { nanoid } from 'nanoid';

export const ChatService = {
  async listForUser(userId: string): Promise<Conversation[]> {
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

    const membersByConv: Record<string, ConversationMember[]> = {};
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
        profile: m.profile as Profile,
      });
    }

    const result: Conversation[] = [];
    for (const conv of conversations || []) {
      const { data: unreadData } = await adminClient.rpc('get_unread_count', {
        p_conversation_id: conv.id,
        p_user_id: userId,
      });

      result.push({
        ...conv,
        members: membersByConv[conv.id] || [],
        unread_count: unreadData || 0,
      } as Conversation);
    }

    return result;
  },

  async getById(id: string): Promise<Conversation> {
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
        profile: m.profile as Profile,
      })) || [],
    } as Conversation;
  },

  async createDirect(userId1: string, userId2: string): Promise<Conversation> {
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

  async createGroup(params: {
    name: string;
    description?: string;
    avatar_url?: string;
    created_by: string;
    member_ids: string[];
  }): Promise<Conversation> {
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
        role: 'member' as const,
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

  async addMember(conversationId: string, userId: string, role?: 'admin' | 'member'): Promise<void> {
    const adminClient = getAdminClient();
    const { error } = await adminClient.from('conversation_members').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: role || 'member',
    });

    if (error) throw error;
  },

  async removeMember(conversationId: string, userId: string): Promise<void> {
    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async getMembers(conversationId: string): Promise<ConversationMember[]> {
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
      profile: m.profile as Profile,
    }));
  },

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    return !!data && !error;
  },

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Conversation;
  },

  async deleteConversation(id: string): Promise<void> {
    const adminClient = getAdminClient();
    const { error } = await adminClient.from('conversations').delete().eq('id', id);
    if (error) throw error;
  },
};
