import { getAdminClient } from '../lib/supabase-admin';
import { Profile, UserPermissions } from '../lib/types';

const defaultPermissions: UserPermissions = {
  can_view_jobs: true,
  can_claim_jobs: true,
  can_create_groups: true,
  can_send_files: true,
  can_send_messages: true,
};

export const UserService = {
  async list(): Promise<Profile[]> {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as Profile[];
  },

  async getById(id: string): Promise<Profile> {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Profile;
  },

  async create(params: {
    email: string;
    password: string;
    username: string;
    display_name: string;
    role?: 'admin' | 'member';
    permissions?: Partial<UserPermissions>;
  }): Promise<Profile> {
    const adminClient = getAdminClient();

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: {
        username: params.username,
        display_name: params.display_name,
        role: params.role || 'member',
      },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Failed to create user');
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    const mergedPermissions = {
      ...defaultPermissions,
      ...params.permissions,
    };

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .update({
        username: params.username,
        display_name: params.display_name,
        role: params.role || 'member',
        permissions: mergedPermissions,
      })
      .eq('id', authData.user.id)
      .select()
      .single();

    if (profileError) {
      throw new Error(profileError.message);
    }

    return profile as Profile;
  },

  async update(id: string, updates: Partial<Profile>): Promise<Profile> {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  },

  async updatePermissions(id: string, partialPermissions: Partial<UserPermissions>): Promise<Profile> {
    const adminClient = getAdminClient();
    const { data: current, error: fetchError } = await adminClient
      .from('profiles')
      .select('permissions')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const mergedPermissions = {
      ...(current.permissions || defaultPermissions),
      ...partialPermissions,
    };

    const { data, error } = await adminClient
      .from('profiles')
      .update({ permissions: mergedPermissions })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  },

  async deactivate(id: string): Promise<void> {
    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from('profiles')
      .update({ is_active: false, is_online: false })
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const adminClient = getAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) throw error;
  },

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const adminClient = getAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(id, {
      password: newPassword,
    });

    if (error) throw error;
  },

  async setOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    const adminClient = getAdminClient();
    const { error } = await adminClient
      .from('profiles')
      .update({
        is_online: isOnline,
        last_seen: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },
};
