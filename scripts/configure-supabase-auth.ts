/**
 * Configures Supabase Auth redirect URLs and Site URL for production.
 *
 * Why: Supabase must know your production domain so that auth-related emails
 * (confirmation, password reset) link back to the correct origin, and so that
 * the auth callback route at /auth/callback is allowed as a redirect target.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx PRODUCTION_URL=https://mbook.vercel.app npx tsx scripts/configure-supabase-auth.ts
 *
 * Where to get the access token:
 *   https://supabase.com/dashboard/account/tokens
 */

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PRODUCTION_URL = process.env.PRODUCTION_URL;

if (!SUPABASE_URL) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

if (!ACCESS_TOKEN) {
  console.error(
    'Missing SUPABASE_ACCESS_TOKEN. Generate one at:\n' +
      '  https://supabase.com/dashboard/account/tokens\n' +
      'Then pass it: SUPABASE_ACCESS_TOKEN=sbp_xxx npx tsx scripts/configure-supabase-auth.ts'
  );
  process.exit(1);
}

if (!PRODUCTION_URL) {
  console.error(
    'Missing PRODUCTION_URL. Pass your Vercel domain:\n' +
      '  PRODUCTION_URL=https://mbook.vercel.app npx tsx scripts/configure-supabase-auth.ts'
  );
  process.exit(1);
}

// Extract project ref from the Supabase URL (https://<ref>.supabase.co)
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

// Wildcard patterns that Supabase accepts for redirect URL matching.
// The production URL covers exact domain; the preview pattern covers
// Vercel's auto-generated preview deployment subdomains.
const redirectAllowList = [
  `${PRODUCTION_URL}/**`,
  `${PRODUCTION_URL.replace('https://', 'https://*.')
    .replace('.vercel.app', '-*.vercel.app')}/**`,
  'http://localhost:3000/**',
].join(',');

async function configureAuth(): Promise<void> {
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;

  console.log(`Configuring auth for project: ${projectRef}`);
  console.log(`  Site URL:       ${PRODUCTION_URL}`);
  console.log(`  Redirect allow: ${redirectAllowList}`);

  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site_url: PRODUCTION_URL,
      uri_allow_list: redirectAllowList,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Failed to update auth config (${response.status}):`, body);
    process.exit(1);
  }

  const result = await response.json();
  console.log('\nAuth config updated successfully:');
  console.log(`  site_url:        ${result.site_url}`);
  console.log(`  uri_allow_list:  ${result.uri_allow_list}`);
}

configureAuth();
