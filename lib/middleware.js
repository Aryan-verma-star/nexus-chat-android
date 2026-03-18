import { getAdminClient } from 'supabase-admin';

export function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Secret-Key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export async function withAuth(req, res) {
  if (handleCors(req, res)) {
    return null;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, data: null, error: 'Missing or invalid authorization header' });
    return null;
  }

  const token = authHeader.substring(7);
  const adminClient = getAdminClient();

  const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

  if (authError || !user) {
    res.status(401).json({ success: false, data: null, error: 'Invalid token' });
    return null;
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    res.status(401).json({ success: false, data: null, error: 'Profile not found' });
    return null;
  }

  if (!profile.is_active) {
    res.status(403).json({ success: false, data: null, error: 'Account is deactivated' });
    return null;
  }

  await adminClient
    .from('profiles')
    .update({ is_online: true, last_seen: new Date().toISOString() })
    .eq('id', profile.id);

  return {
    ...req,
    user: profile,
    accessToken: token,
  };
}

export async function withAdmin(req, res) {
  const authenticatedReq = await withAuth(req, res);
  
  if (!authenticatedReq) {
    return null;
  }

  if (authenticatedReq.user.role !== 'admin') {
    res.status(403).json({ success: false, data: null, error: 'Admin access required' });
    return null;
  }

  return authenticatedReq;
}

export function withSecret(req, res) {
  if (handleCors(req, res)) {
    return false;
  }

  const secretKey = req.headers['x-secret-key'];
  const expectedSecret = process.env.NEXUS_SECRET_KEY;

  if (!secretKey || secretKey !== expectedSecret) {
    res.status(401).json({ success: false, data: null, error: 'Invalid secret key' });
    return false;
  }

  return true;
}

export function checkPermission(user, permission) {
  return user.permissions?.[permission] === true;
}

export async function logActivity(userId, action, details = {}, ipAddress) {
  const adminClient = getAdminClient();
  
  await adminClient.from('activity_logs').insert({
    user_id: userId,
    action,
    details,
    ip_address: ipAddress || null,
  });
}