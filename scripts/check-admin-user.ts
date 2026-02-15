// scripts/check-admin-user.ts
// Verifies admin user exists in both auth.users (via API) and public.users
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = 'saiesh.nat@gmail.com';

async function checkAdminUser() {
  console.log('\n🔍 Checking admin user in Supabase...\n');

  // 1. Check auth.users (via Admin API)
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    perPage: 100,
  });

  if (authError) {
    console.error('⚠️  Could not list auth users:', authError.message);
    console.log('   (Will still check public.users)\n');
  }

  const authUser = authData?.users?.find((u) => u.email === ADMIN_EMAIL);
  if (authUser) {
    console.log('✅ Auth (auth.users):');
    console.log('   - ID:', authUser.id);
    console.log('   - Email:', authUser.email);
    console.log('   - Email confirmed:', authUser.email_confirmed_at ? 'Yes' : 'No');
    console.log('   - Metadata role:', authUser.user_metadata?.role ?? '(none)');
  } else {
    console.log('❌ Auth (auth.users): Admin user NOT FOUND');
    console.log('   Expected email:', ADMIN_EMAIL);
  }

  // 2. Check public.users
  const { data: publicUsers, error: publicError } = await supabase
    .from('users')
    .select('id, email, name, role, is_active, created_at')
    .or(`email.eq.${ADMIN_EMAIL},role.eq.admin`);

  if (publicError) {
    console.error('❌ Error querying public.users:', publicError.message);
    return;
  }

  const adminInPublic = publicUsers?.find((u) => u.email === ADMIN_EMAIL);
  const allAdmins = publicUsers?.filter((u) => u.role === 'admin') ?? [];

  console.log('\n📋 Public (public.users):');
  if (adminInPublic) {
    console.log('   Admin user found:');
    console.log('   - ID:', adminInPublic.id);
    console.log('   - Email:', adminInPublic.email);
    console.log('   - Name:', adminInPublic.name);
    console.log('   - Role:', adminInPublic.role);
    console.log('   - is_active:', adminInPublic.is_active);
    console.log('   - created_at:', adminInPublic.created_at);
  } else {
    console.log('   ❌ Admin user NOT FOUND (email:', ADMIN_EMAIL + ')');
  }

  if (allAdmins.length > 0) {
    console.log('\n   All users with role=admin:', allAdmins.length);
    allAdmins.forEach((u) => console.log('   -', u.email, '|', u.name, '|', u.role));
  }

  // Summary
  console.log('\n' + '─'.repeat(50));
  const authOk = !!authUser;
  const publicOk = !!adminInPublic;
  const roleOk = adminInPublic?.role === 'admin';

  if (authOk && publicOk && roleOk) {
    console.log('✅ Admin user is properly set up in Supabase');
  } else {
    console.log('⚠️  Issues detected:');
    if (!authOk) console.log('   - User missing in auth.users');
    if (!publicOk) console.log('   - User missing in public.users');
    if (publicOk && !roleOk) console.log('   - public.users role is not "admin" (got:', adminInPublic?.role + ')');
    console.log('\n   Run: npx tsx scripts/create-admin-user.ts');
  }
  console.log('');
}

checkAdminUser();
