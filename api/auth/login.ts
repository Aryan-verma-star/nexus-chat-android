import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, logActivity } from '../../lib/middleware';
import { createSupabaseClient } from '../../lib/supabase';
import { getAdminClient } from '../../lib/supabase-admin';
import { UserService } from '../../lib/services/user.service';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, data: null, error: 'Method not allowed' });
    return;
  }

  try {
    const { email, username, password } = req.body;

    if (!password) {
      res.status(400).json({ success: false, data: null, error: 'Password is required' });
      return;
    }

    let userEmail = email;
    let userId: string | null = null;

    if (username && !email) {
      const profiles = await UserService.list();
      const profile = profiles.find(p => p.username === username);
      
      if (!profile) {
        res.status(401).json({ success: false, data: null, error: 'Invalid credentials' });
        return;
      }

      const adminClient = getAdminClient();
      const { data: authUser } = await adminClient.auth.admin.getUserById(profile.id);
      
      if (!authUser?.user) {
        res.status(401).json({ success: false, data: null, error: 'Invalid credentials' });
        return;
      }

      userEmail = authUser.user.email;
      userId = profile.id;
    }

    if (!userEmail) {
      res.status(400).json({ success: false, data: null, error: 'Email or username is required' });
      return;
    }

    const supabase = createSupabaseClient();
    const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    if (signInError || !session.user) {
      res.status(401).json({ success: false, data: null, error: 'Invalid credentials' });
      return;
    }

    const profile = await UserService.getById(session.user.id);

    if (!profile.is_active) {
      res.status(403).json({ success: false, data: null, error: 'Account is deactivated' });
      return;
    }

    await UserService.setOnlineStatus(session.user.id, true);
    await logActivity(session.user.id, 'user.login', {}, req.headers['x-forwarded-for'] as string);

    res.status(200).json({
      success: true,
      data: {
        user: profile,
        session: {
          access_token: session.session.access_token,
          refresh_token: session.session.refresh_token,
          expires_at: session.session.expires_at,
        },
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, data: null, error: error.message || 'Internal server error' });
  }
}
