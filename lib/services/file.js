import { getAdminClient } from 'supabase-admin';
import { nanoid } from 'nanoid';

export const FileService = {
  async getUploadUrl(params) {
    const adminClient = getAdminClient();

    const ext = params.fileName.split('.').pop() || 'bin';
    const uniqueName = nanoid(24);
    const path = `${params.conversationId}/${uniqueName}.${ext}`;

    const { data, error } = await adminClient.storage
      .from('nexus-files')
      .createSignedUploadUrl(path);

    if (error) throw error;

    return {
      path,
      signedUrl: data.signedUrl,
    };
  },

  async getDownloadUrl(path) {
    const adminClient = getAdminClient();

    const { data, error } = await adminClient.storage
      .from('nexus-files')
      .createSignedUrl(path, 3600);

    if (error) throw error;

    return data.signedUrl;
  },

  async deleteFile(path) {
    const adminClient = getAdminClient();
    const { error } = await adminClient.storage
      .from('nexus-files')
      .remove([path]);

    if (error) throw error;
  },
};