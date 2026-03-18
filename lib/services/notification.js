import { getAdminClient } from 'supabase-admin';

export const NotificationService = {
  async create(params) {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('notifications')
      .insert({
        user_id: params.user_id,
        type: params.type,
        title: params.title,
        body: params.body || null,
        data: params.data || {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async listForUser(userId, params = {}) {
    const adminClient = getAdminClient();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const { data, count, error } = await adminClient
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      notifications: data || [],
      total: count || 0,
    };
  },

  async getUnreadCount(userId) {
    const adminClient = getAdminClient();
    const { count, error } = await adminClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  },

  async markAsRead(notificationIds, userId) {
    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .in('id', notificationIds);

    if (error) throw error;
  },

  async markAllAsRead(userId) {
    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
  },

  async broadcastToAll(params) {
    const adminClient = getAdminClient();

    let query = adminClient
      .from('profiles')
      .select('id')
      .eq('is_active', true);

    if (params.excludeUserId) {
      query = query.neq('id', params.excludeUserId);
    }

    const { data: users } = await query;

    if (!users || users.length === 0) return;

    const notifications = users.map(u => ({
      user_id: u.id,
      type: params.type,
      title: params.title,
      body: params.body || null,
      data: params.data || {},
    }));

    await adminClient.from('notifications').insert(notifications);
  },
};