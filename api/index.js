const services = {
  supabase: (() => {
    const { createClient } = require('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  })(),
  supabaseAdmin: (() => {
    const { createClient } = require('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  })(),
};

const handleCors = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Secret-Key');
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
  return false;
};

const auth = async (req, res) => {
  if (handleCors(req, res)) return;
  const { method } = req;
  const sb = services.supabase;
  const admin = services.supabaseAdmin;

  // LOGIN
  if (method === 'POST' && req.url === '/api/auth/login') {
    const { email, username, password } = req.body || {};
    if (!password) { res.status(400).json({ success: false, data: null, error: 'Password required' }); return; }
    
    try {
      let userEmail = email;
      
      if (username && !email) {
        if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
        const { data: profiles } = await admin.from('profiles').select('*');
        const profile = profiles?.find(p => p.username === username);
        if (!profile) { res.status(401).json({ success: false, data: null, error: 'Invalid credentials' }); return; }
        const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
        if (!authUser?.user) { res.status(401).json({ success: false, data: null, error: 'Invalid credentials' }); return; }
        userEmail = authUser.user.email;
      }

      if (!userEmail) { res.status(400).json({ success: false, data: null, error: 'Email or username required' }); return; }

      const { data: session, error: signInError } = await sb.auth.signInWithPassword({ email: userEmail, password });
      if (signInError || !session?.user) { res.status(401).json({ success: false, data: null, error: 'Invalid credentials' }); return; }

      if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
      const { data: profile } = await admin.from('profiles').select('*').eq('id', session.user.id).single();
      if (!profile?.is_active) { res.status(403).json({ success: false, data: null, error: 'Account deactivated' }); return; }

      await admin.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', session.user.id);

      res.status(200).json({
        success: true,
        data: { user: profile, session: { access_token: session.session.access_token, refresh_token: session.session.refresh_token, expires_at: session.session.expires_at } },
        error: null
      });
    } catch (err) { res.status(500).json({ success: false, data: null, error: err.message }); }
    return;
  }

  // LOGOUT
  if (method === 'POST' && req.url === '/api/auth/logout') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) { res.status(401).json({ success: false, data: null, error: 'No token' }); return; }
    const { data: { user } } = await sb.auth.getUser(token);
    if (user && admin) await admin.from('profiles').update({ is_online: false }).eq('id', user.id);
    res.status(200).json({ success: true, data: { message: 'Logged out' }, error: null });
    return;
  }

  // ME
  if (method === 'GET' && req.url === '/api/auth/me') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) { res.status(401).json({ success: false, data: null, error: 'No token' }); return; }
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) { res.status(401).json({ success: false, data: null, error: 'Invalid token' }); return; }
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single();
    const { count } = await admin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
    res.status(200).json({ success: true, data: { user: profile, unread_notification_count: count || 0 }, error: null });
    return;
  }

  res.status(404).json({ success: false, data: null, error: 'Not found' });
};

const users = async (req, res) => {
  if (handleCors(req, res)) return;
  const { method, url } = req;
  const sb = services.supabase;
  const admin = services.supabaseAdmin;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) { res.status(401).json({ success: false, data: null, error: 'Unauthorized' }); return; }
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) { res.status(401).json({ success: false, data: null, error: 'Invalid token' }); return; }

  // LIST
  if (method === 'GET' && url === '/api/users') {
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    const { data } = await admin.from('profiles').select('*').order('created_at', { ascending: true });
    res.status(200).json({ success: true, data: data || [], error: null });
    return;
  }

  // GET ONE
  if (method === 'GET' && url?.startsWith('/api/users/')) {
    const id = url.split('/')[3];
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    const { data } = await admin.from('profiles').select('*').eq('id', id).single();
    res.status(200).json({ success: true, data: data, error: null });
    return;
  }

  // UPDATE
  if ((method === 'PUT' || method === 'PATCH') && url?.startsWith('/api/users/')) {
    const id = url.split('/')[3];
    const updates = req.body || {};
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    const { data } = await admin.from('profiles').update(updates).eq('id', id).select().single();
    res.status(200).json({ success: true, data: data, error: null });
    return;
  }

  res.status(404).json({ success: false, data: null, error: 'Not found' });
};

const conversations = async (req, res) => {
  if (handleCors(req, res)) return;
  const { method, url } = req;
  const sb = services.supabase;
  const admin = services.supabaseAdmin;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ success: false, data: null, error: 'Unauthorized' }); return; }
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) { res.status(401).json({ success: false, data: null, error: 'Invalid token' }); return; }

  // LIST
  if (method === 'GET' && url === '/api/conversations') {
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    const { data: members } = await admin.from('conversation_members').select('conversation_id').eq('user_id', user.id);
    if (!members?.length) { res.status(200).json({ success: true, data: [], error: null }); return; }
    const ids = members.map(m => m.conversation_id);
    const { data: convs } = await admin.from('conversations').select('*, members:conversation_members(*, profile:profiles(*))').in('id', ids).order('last_message_at', { ascending: false });
    res.status(200).json({ success: true, data: convs || [], error: null });
    return;
  }

  // CREATE
  if (method === 'POST' && url === '/api/conversations') {
    const { type, user_id, name, member_ids } = req.body || {};
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    
    if (type === 'direct') {
      const { data: existing } = await admin.from('conversation_members').select('conversation_id').eq('user_id', user.id);
      if (existing?.length) {
        for (const item of existing) {
          const { data: other } = await admin.from('conversation_members').select('user_id').eq('conversation_id', item.conversation_id).eq('user_id', user_id).single();
          if (other) { const { data } = await admin.from('conversations').select('*').eq('id', item.conversation_id).single(); res.status(201).json({ success: true, data, error: null }); return; }
        }
      }
      const { data: conv } = await admin.from('conversations').insert({ type: 'direct', created_by: user.id }).select().single();
      await admin.from('conversation_members').insert([{ conversation_id: conv.id, user_id: user.id, role: 'admin' }, { conversation_id: conv.id, user_id: user_id, role: 'admin' }]);
      res.status(201).json({ success: true, data: conv, error: null });
      return;
    }
    
    if (type === 'group') {
      const { data: conv } = await admin.from('conversations').insert({ type: 'group', name, created_by: user.id }).select().single();
      const members = [{ conversation_id: conv.id, user_id: user.id, role: 'admin' }, ...(member_ids || []).map(id => ({ conversation_id: conv.id, user_id: id, role: 'member' }))];
      await admin.from('conversation_members').insert(members);
      res.status(201).json({ success: true, data: conv, error: null });
      return;
    }
    
    res.status(400).json({ success: false, data: null, error: 'Invalid type' });
    return;
  }

  res.status(404).json({ success: false, data: null, error: 'Not found' });
};

const messages = async (req, res) => {
  if (handleCors(req, res)) return;
  const { method, url } = req;
  const sb = services.supabase;
  const admin = services.supabaseAdmin;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ success: false, data: null, error: 'Unauthorized' }); return; }
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) { res.status(401).json({ success: false, data: null, error: 'Invalid token' }); return; }

  // GET MESSAGES
  if (method === 'GET' && url?.match(/^\/api\/conversations\/([^/]+)\/messages/)) {
    const convId = url.split('/')[3];
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    const { data, count } = await admin.from('messages').select('*, sender:profiles(*)', { count: 'exact' }).eq('conversation_id', convId).eq('is_deleted', false).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    res.status(200).json({ success: true, data: (data || []).reverse(), error: null, pagination: { page, limit, total: count || 0, hasMore: offset + limit < (count || 0) } });
    return;
  }

  // SEND MESSAGE
  if (method === 'POST' && url?.match(/^\/api\/conversations\/([^/]+)\/messages/)) {
    const convId = url.split('/')[3];
    const { content, type = 'text', reply_to } = req.body || {};
    if (!content) { res.status(400).json({ success: false, data: null, error: 'Content required' }); return; }
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    const { data } = await admin.from('messages').insert({ conversation_id: convId, sender_id: user.id, content, type, reply_to }).select('*, sender:profiles(*)').single();
    res.status(201).json({ success: true, data, error: null });
    return;
  }

  // MARK READ
  if (method === 'POST' && url?.match(/^\/api\/conversations\/([^/]+)\/read/)) {
    const convId = url.split('/')[3];
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    await admin.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', convId).eq('user_id', user.id);
    res.status(200).json({ success: true, data: { message: 'Marked as read' }, error: null });
    return;
  }

  res.status(404).json({ success: false, data: null, error: 'Not found' });
};

const jobs = async (req, res) => {
  if (handleCors(req, res)) return;
  const { method, url } = req;
  const sb = services.supabase;
  const admin = services.supabaseAdmin;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ success: false, data: null, error: 'Unauthorized' }); return; }
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) { res.status(401).json({ success: false, data: null, error: 'Invalid token' }); return; }

  // LIST JOBS
  if (method === 'GET' && url === '/api/jobs') {
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    let query = admin.from('jobs').select('*, claimer:profiles(*)', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.platform) query = query.eq('platform', req.query.platform);
    const { data, count } = await query;
    res.status(200).json({ success: true, data: data || [], error: null, pagination: { page, limit, total: count || 0, hasMore: offset + limit < (count || 0) } });
    return;
  }

  // CLAIM JOB
  if (method === 'POST' && url?.match(/^\/api\/jobs\/([^/]+)\/claim/)) {
    const jobId = url.split('/')[3];
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    const { data: job } = await admin.from('jobs').select('status').eq('id', jobId).single();
    if (job?.status !== 'new') { res.status(400).json({ success: false, data: null, error: 'Job not available' }); return; }
    const { data } = await admin.from('jobs').update({ status: 'claimed', claimed_by: user.id, claimed_at: new Date().toISOString() }).eq('id', jobId).select().single();
    res.status(200).json({ success: true, data, error: null });
    return;
  }

  res.status(404).json({ success: false, data: null, error: 'Not found' });
};

const notifications = async (req, res) => {
  if (handleCors(req, res)) return;
  const { method, url } = req;
  const sb = services.supabase;
  const admin = services.supabaseAdmin;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ success: false, data: null, error: 'Unauthorized' }); return; }
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) { res.status(401).json({ success: false, data: null, error: 'Invalid token' }); return; }

  if (method === 'GET' && url === '/api/notifications') {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    const { data, count } = await admin.from('notifications').select('*', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { count: unread } = await admin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
    res.status(200).json({ success: true, data: data || [], error: null, unread_count: unread || 0 });
    return;
  }

  if (method === 'POST' && url === '/api/notifications/read') {
    const { notification_ids, mark_all } = req.body || {};
    if (!admin) { res.status(500).json({ success: false, data: null, error: 'Server error' }); return; }
    if (mark_all) { await admin.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false); }
    else if (notification_ids?.length) { await admin.from('notifications').update({ is_read: true }).eq('user_id', user.id).in('id', notification_ids); }
    res.status(200).json({ success: true, data: { message: 'Done' }, error: null });
    return;
  }

  res.status(404).json({ success: false, data: null, error: 'Not found' });
};

module.exports = async (req, res) => {
  const { url } = req;
  
  if (url?.startsWith('/api/auth')) return auth(req, res);
  if (url?.startsWith('/api/users')) return users(req, res);
  if (url?.startsWith('/api/conversations')) return conversations(req, res);
  if (url?.match(/^\/api\/conversations\/[^/]+\/messages/) || url?.match(/^\/api\/conversations\/[^/]+\/read/)) return messages(req, res);
  if (url?.startsWith('/api/jobs')) return jobs(req, res);
  if (url?.startsWith('/api/notifications')) return notifications(req, res);
  
  res.status(404).json({ success: false, data: null, error: 'API endpoint not found' });
};
