# mBook - Landscaping Measurement Management

A mobile-first web application for managing landscaping measurements and billing calculations.

## Features

- 📱 Mobile-optimized web interface
- 📏 Measurement tracking and management
- 🤖 LLM integration for intelligent analysis
- 👨‍💼 Admin panel for configuration
- 💰 Automated billing calculations

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL) - *to be configured*
- **AI/LLM**: OpenAI/Anthropic API - *to be configured*
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier available)
- OpenAI or Anthropic API key (optional, for LLM features)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd mbook
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file:
```bash
cp .env.example .env.local
```

4. Configure your environment variables (see Environment Variables section)

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LLM API Configuration (choose one)
OPENAI_API_KEY=your_openai_api_key
# OR
ANTHROPIC_API_KEY=your_anthropic_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Project Structure

```
mbook/
├── app/
│   ├── api/              # API routes
│   │   ├── measurements/ # Measurement endpoints
│   │   └── llm/          # LLM integration endpoints
│   ├── admin/            # Admin panel pages
│   ├── measurements/     # User-facing measurement pages
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── components/
│   └── ui/               # Reusable UI components
├── lib/
│   ├── supabase.ts       # Supabase client (to be created)
│   └── llm.ts            # LLM utilities (to be created)
└── public/               # Static assets
```

## Next Steps

### 1. Database Setup (Supabase)

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the following SQL to create your tables:

```sql
-- Measurements table
create table measurements (
  id uuid default gen_random_uuid() primary key,
  client_name text not null,
  location text not null,
  length numeric,
  width numeric,
  area numeric,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table measurements enable row level security;

-- Create policy for authenticated users
create policy "Enable all access for authenticated users"
  on measurements
  for all
  using (auth.role() = 'authenticated');
```

3. Add your Supabase credentials to `.env.local`

### 2. LLM Integration

Install the LLM client of your choice:

```bash
# For OpenAI
npm install openai

# For Anthropic
npm install @anthropic-ai/sdk
```

### 3. Additional Features to Implement

- [ ] User authentication (Supabase Auth)
- [ ] Photo upload for measurements
- [ ] GPS location capture
- [ ] Billing rate configuration
- [ ] Invoice generation
- [ ] Export to PDF
- [ ] Offline support with PWA
- [ ] Multi-user collaboration

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Configure environment variables in Vercel dashboard
4. Deploy!

Vercel will automatically deploy on every push to your main branch.

## Cost Estimates

- **Hosting (Vercel)**: Free tier (upgrades at $20/mo if needed)
- **Database (Supabase)**: Free tier (500MB)
- **LLM API**: ~$5-20/mo depending on usage
- **Total**: $0-5/mo for small deployments

## Support

For issues or questions, please open an issue on GitHub.

## License

MIT
