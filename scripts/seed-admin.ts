import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME || 'Admin';

async function seedAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Creating admin user...');

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username: 'admin',
      display_name: ADMIN_DISPLAY_NAME,
      role: 'admin',
    },
  });

  if (authError) {
    console.error('Error creating user:', authError.message);
    process.exit(1);
  }

  console.log('User created:', authData.user?.id);

  await new Promise(resolve => setTimeout(resolve, 1000));

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      username: 'admin',
      display_name: ADMIN_DISPLAY_NAME,
      role: 'admin',
      permissions: {
        can_view_jobs: true,
        can_claim_jobs: true,
        can_create_groups: true,
        can_send_files: true,
        can_send_messages: true,
      },
    })
    .eq('id', authData.user!.id);

  if (profileError) {
    console.error('Error updating profile:', profileError.message);
    process.exit(1);
  }

  console.log('Admin user seeded successfully!');
  console.log(`Email: ${ADMIN_EMAIL}`);
}

seedAdmin().catch(console.error);
