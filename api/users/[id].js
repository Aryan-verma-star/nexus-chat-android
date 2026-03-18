import { withAuth, withAdmin, logActivity } from '../../lib/middleware';
import { UserService } from '../../lib/services/user';

export default async function(req, res) {
  const authReq = await withAuth(req, res);
  if (!authReq) return;

  const { id } = req.query;
  const userId = Array.isArray(id) ? id[0] : id;

  if (req.method === 'GET') {
    try {
      const user = await UserService.getById(userId);
      res.status(200).json({ success: true, data: user, error: null });
    } catch (error) {
      console.error('User get error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const isOwnProfile = authReq.user.id === userId;
      const isAdmin = authReq.user.role === 'admin';

      if (!isOwnProfile && !isAdmin) {
        res.status(403).json({ success: false, data: null, error: 'Not authorized' });
        return;
      }

      const updates = {};

      if (req.body.display_name) updates.display_name = req.body.display_name;
      if (req.body.avatar_url !== undefined) updates.avatar_url = req.body.avatar_url;
      if (req.body.custom_status !== undefined) updates.custom_status = req.body.custom_status;

      if (isAdmin) {
        if (req.body.role) updates.role = req.body.role;
        if (req.body.permissions) updates.permissions = req.body.permissions;
        if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
      }

      const user = await UserService.update(userId, updates);
      res.status(200).json({ success: true, data: user, error: null });
    } catch (error) {
      console.error('User update error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const adminReq = await withAdmin(req, res);
    if (!adminReq) return;

    try {
      await UserService.delete(userId);
      await logActivity(adminReq.user.id, 'admin.user.delete', { deleted_user_id: userId });
      res.status(200).json({ success: true, data: { message: 'User deleted' }, error: null });
    } catch (error) {
      console.error('User delete error:', error);
      res.status(500).json({ success: false, data: null, error: error.message });
    }
    return;
  }

  res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
}