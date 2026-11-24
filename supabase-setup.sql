-- Citizen Services Portal: Supabase setup
-- Run this script in Supabase SQL Editor. It creates a private reports table and attachment bucket.

create extension if not exists pgcrypto;

create table if not exists public.citizen_reports (
  id uuid primary key default gen_random_uuid(),
  issue_area text not null check (char_length(issue_area) between 1 and 80),
  issue_type text not null check (char_length(issue_type) between 1 and 120),
  department text not null check (char_length(department) between 1 and 160),
  city text not null check (char_length(city) between 1 and 100),
  location text not null check (char_length(location) between 1 and 150),
  reporter_name text check (reporter_name is null or char_length(reporter_name) <= 80),
  reporter_email text check (reporter_email is null or char_length(reporter_email) <= 120),
  description text not null check (char_length(description) between 10 and 1500),
  attachment_path text,
  status text not null default 'new' check (status in ('new','reviewing','resolved','closed')),
  created_at timestamptz not null default now()
);

alter table public.citizen_reports enable row level security;
revoke all on public.citizen_reports from anon, authenticated;
grant insert on public.citizen_reports to anon;

drop policy if exists "Public can submit new citizen reports" on public.citizen_reports;
create policy "Public can submit new citizen reports"
  on public.citizen_reports for insert to anon
  with check (status = 'new');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('citizen-report-attachments', 'citizen-report-attachments', false, 2097152,
        array['image/jpeg','image/png','image/webp','image/gif','image/heic'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anonymous visitors can upload attachments only; they cannot list, read, change, or delete them.
drop policy if exists "Public can upload report attachments" on storage.objects;
create policy "Public can upload report attachments"
  on storage.objects for insert to anon
  with check (bucket_id = 'citizen-report-attachments');
