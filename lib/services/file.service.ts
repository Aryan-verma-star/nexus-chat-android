import { getAdminClient } from '../lib/supabase-admin';
import { nanoid } from 'nanoid';

export const FileService = {
  async getUploadUrl(params: {
    fileName: string;
    fileType: string;
    conversationId: string;
    userId: string;
  }): Promise<{ path: string; signedUrl: string }> {
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

  async getDownloadUrl(path: string): Promise<string> {
    const adminClient = getAdminClient();

    const { data, error } = await adminClient.storage
      .from('nexus-files')
      .createSignedUrl(path, 3600);

    if (error) throw error;

    return data.signedUrl;
  },

  async deleteFile(path: string): Promise<void> {
    const adminClient = getAdminClient();
    const { error } = await adminClient.storage
      .from('nexus-files')
      .remove([path]);

    if (error) throw error;
  },
};
