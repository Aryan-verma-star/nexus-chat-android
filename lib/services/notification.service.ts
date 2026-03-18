import { getAdminClient } from '../lib/supabase-admin';
import { Notification } from '../lib/types';

export const NotificationService = {
  async create(params: {
    user_id: string;
    type: 'new_message' | 'new_job' | 'job_claimed' | 'job_completed' | 'user_joined' | 'user_left' | 'admin_announcement' | 'mention';
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  }): Promise<Notification> {
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
    return data as Notification;
  },

  async listForUser(
    userId: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<{ notifications: Notification[]; total: number }> {
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
      notifications: (data || []) as Notification[],
      total: count || 0,
    };
  },

  async getUnreadCount(userId: string): Promise<number> {
    const adminClient = getAdminClient();
    const { count, error } = await adminClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  },

  async markAsRead(notificationIds: string[], userId: string): Promise<void> {
    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .in('id', notificationIds);

    if (error) throw error;
  },

  async markAllAsRead(userId: string): Promise<void> {
    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
  },

  async broadcastToAll(params: {
    type: 'new_message' | 'new_job' | 'job_claimed' | 'job_completed' | 'user_joined' | 'user_left' | 'admin_announcement' | 'mention';
    title: string;
    body?: string;
    data?: Record<string, unknown>;
    excludeUserId?: string;
  }): Promise<void> {
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
