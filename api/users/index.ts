import { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, withAdmin, logActivity } from '../../lib/middleware';
import { UserService } from '../../lib/services/user.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'GET') {
    const authReq = await withAuth(req, res);
    if (!authReq) return;

    try {
      const users = await UserService.list();
      res.status(200).json({ success: true, data: users, error: null });
    } catch (error: any) {
      console.error('Users list error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  if (req.method === 'POST') {
    const authReq = await withAdmin(req, res);
    if (!authReq) return;

    try {
      const { email, password, username, display_name, role, permissions } = req.body;

      if (!email || !password || !username || !display_name) {
        res.status(400).json({ success: false, data: null, error: 'Missing required fields' });
        return;
      }

      const user = await UserService.create({ email, password, username, display_name, role, permissions });
      await logActivity(authReq.user.id, 'admin.user.create', { user_id: user.id, username: user.username });

      res.status(201).json({ success: true, data: user, error: null });
    } catch (error: any) {
      console.error('User create error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
}
