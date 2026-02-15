// scripts/create-admin-user.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminUser() {
  try {
    // Create user via Supabase Auth Admin API
    const { data: user, error: authError } = await supabase.auth.admin.createUser({
      email: 'saiesh.nat@gmail.com',
      password: 'Dolphin@123',
      email_confirm: true,
      user_metadata: {
        name: 'Admin User',
        role: 'admin'
      }
    });

    if (authError) {
      console.error('Error creating user:', authError);
      return;
    }

    console.log('✅ User created in auth.users:', user.user.id);

    // Update role in public.users table
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ role: 'admin', name: 'Admin User' })
      .eq('id', user.user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user role:', updateError);
      return;
    }

    console.log('✅ Admin user created successfully:', updatedUser);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createAdminUser();