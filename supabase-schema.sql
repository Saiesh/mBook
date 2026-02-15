-- mBook Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Measurements table
create table if not exists measurements (
  id uuid default uuid_generate_v4() primary key,
  client_name text not null,
  location text not null,
  length numeric,
  width numeric,
  area numeric,
  notes text,
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Pricing configuration table
create table if not exists pricing_config (
  id uuid default uuid_generate_v4() primary key,
  service_type text not null,
  rate_per_sq_ft numeric not null,
  minimum_charge numeric default 0,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User profiles table (extends auth.users)
create table if not exists user_profiles (
  id uuid references auth.users(id) primary key,
  name text,
  role text default 'user' check (role in ('admin', 'user')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table measurements enable row level security;
alter table pricing_config enable row level security;
alter table user_profiles enable row level security;

-- Policies for measurements
create policy "Users can view their own measurements"
  on measurements for select
  using (auth.uid() = user_id);

create policy "Users can insert their own measurements"
  on measurements for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own measurements"
  on measurements for update
  using (auth.uid() = user_id);

create policy "Users can delete their own measurements"
  on measurements for delete
  using (auth.uid() = user_id);

-- Policies for pricing_config (admin only)
create policy "Anyone can view active pricing"
  on pricing_config for select
  using (active = true);

create policy "Admins can manage pricing"
  on pricing_config for all
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policies for user_profiles
create policy "Users can view their own profile"
  on user_profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on user_profiles for update
  using (auth.uid() = id);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers to auto-update updated_at
create trigger update_measurements_updated_at
  before update on measurements
  for each row
  execute function update_updated_at_column();

create trigger update_pricing_config_updated_at
  before update on pricing_config
  for each row
  execute function update_updated_at_column();

create trigger update_user_profiles_updated_at
  before update on user_profiles
  for each row
  execute function update_updated_at_column();

-- Insert default pricing configurations
insert into pricing_config (service_type, rate_per_sq_ft, minimum_charge, active)
values 
  ('Lawn Mowing', 0.05, 25.00, true),
  ('Mulching', 0.15, 50.00, true),
  ('Seeding', 0.10, 40.00, true),
  ('Aeration', 0.08, 35.00, true)
on conflict do nothing;

-- Create a function to automatically create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', 'user');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
