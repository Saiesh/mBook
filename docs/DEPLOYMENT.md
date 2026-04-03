# Deployment Guide for mBook

## Prerequisites

- GitHub account
- Vercel account (free)
- Supabase account (free)
- OpenAI or Anthropic API key (optional)

## Step 1: Database Setup (Supabase)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to finish setting up (2-3 minutes)
3. Go to the SQL Editor in your Supabase dashboard
4. Copy the contents of `database/003_supabase_full.sql` and run it
5. Go to Project Settings > API to get your credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (under service_role)

## Step 2: LLM API Setup (Optional)

### Option A: OpenAI
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Save as `OPENAI_API_KEY`

### Option B: Anthropic
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Save as `ANTHROPIC_API_KEY`

## Step 3: Install Dependencies for Database/LLM

If using Supabase:
```bash
npm install @supabase/supabase-js
```

If using OpenAI:
```bash
npm install openai
```

If using Anthropic:
```bash
npm install @anthropic-ai/sdk
```

Then configure the app (see `.env.example`):
- Copy values into `.env.local` for Supabase and any optional LLM keys
- Server code uses `createServerClient()` from `lib/supabase/server.ts`; browser code uses `getSupabaseBrowserClient()` from `lib/supabase/client.ts`
- Optional LLM usage is wired through `lib/llm.ts` where the feature is enabled

## Step 4: Deploy to Vercel

### Via GitHub (Recommended)

1. Initialize git and push to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/mbook.git
git push -u origin main
```

2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "Add New" > "Project"
4. Import your GitHub repository
5. Configure environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (will be provided by Vercel)
6. Click "Deploy"

### Via CLI

```bash
npm install -g vercel
vercel login
vercel
```

Follow the prompts and add environment variables when asked.

## Step 5: Configure Domain (Optional)

1. In Vercel dashboard, go to your project settings
2. Go to "Domains"
3. Add your custom domain and follow DNS configuration instructions

## Step 6: Test the Deployment

1. Visit your Vercel URL (e.g., `mbook.vercel.app`)
2. Test creating a measurement
3. Test the admin panel
4. Verify database entries in Supabase

## Step 7: Enable Authentication (Optional)

If you want to add user authentication:

1. In Supabase dashboard, go to Authentication > Providers
2. Enable Email provider (or others like Google, GitHub)
3. Update your app to use Supabase Auth:

```typescript
// In a Client Component — reuse the shared browser client so sessions stay consistent with SSR
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const supabase = getSupabaseBrowserClient();

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
});
```

## Continuous Deployment

Once set up, every push to your main branch will automatically deploy to Vercel.

## Monitoring and Analytics

1. In Vercel dashboard, view:
   - Analytics (page views, performance)
   - Logs (server-side errors)
   - Deployment history

2. In Supabase dashboard, view:
   - Database usage
   - API requests
   - Query performance

## Cost Optimization Tips

1. **Stay on free tiers**: Both Vercel and Supabase have generous free tiers
2. **Optimize images**: Use Next.js Image component for automatic optimization
3. **Cache API responses**: Implement caching for LLM responses to reduce API costs
4. **Monitor usage**: Set up billing alerts in both platforms

## Troubleshooting

### Build fails on Vercel
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify environment variables are set correctly

### Database connection issues
- Double-check Supabase URL and keys
- Ensure RLS policies are configured correctly
- Check Supabase logs for errors

### LLM API errors
- Verify API key is correct and has credits
- Check rate limits
- Review API logs for specific errors

## Security Checklist

- [ ] Environment variables are set in Vercel (not in code)
- [ ] `.env.local` is in `.gitignore`
- [ ] Row Level Security is enabled in Supabase
- [ ] Service role key is only used server-side
- [ ] CORS is properly configured
- [ ] Authentication is enabled for sensitive operations

## Next Steps

- Set up monitoring and alerts
- Configure custom domain
- Add more features (photo upload, PDF export, etc.)
- Implement proper authentication
- Add analytics tracking
