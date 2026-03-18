import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, checkPermission } from '../../lib/middleware';
import { FileService } from '../../lib/services/file.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  if (!checkPermission(authReq.user, 'can_send_files')) {
    res.status(403).json({ success: false, data: null, error: 'Permission denied' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const { file_name, file_type, conversation_id } = req.body;

    if (!file_name || !file_type || !conversation_id) {
      res.status(400).json({ success: false, data: null, error: 'file_name, file_type, conversation_id required' });
      return;
    }

    const result = await FileService.getUploadUrl({
      fileName: file_name,
      fileType: file_type,
      conversationId: conversation_id,
      userId: authReq.user.id,
    });

    res.status(201).json({ success: true, data: result, error: null });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, data: null, error: error.message });
  }
}
