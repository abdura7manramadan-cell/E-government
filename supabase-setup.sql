-- Citizen Services Portal: database, report tracking, and admin notifications
-- Run in Supabase SQL Editor. Admin access is granted through user app_metadata.role = 'admin'.
create extension if not exists pgcrypto;

create table if not exists public.citizen_reports (
  id uuid primary key default gen_random_uuid(),
  tracking_number text unique,
  issue_area text not null check (char_length(issue_area) between 1 and 80),
  issue_type text not null check (char_length(issue_type) between 1 and 120),
  department text not null check (char_length(department) between 1 and 160),
  city text not null check (char_length(city) between 1 and 100),
  location text not null check (char_length(location) between 1 and 150),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  reporter_name text check (reporter_name is null or char_length(reporter_name) <= 80),
  reporter_email text check (reporter_email is null or char_length(reporter_email) <= 120),
  description text not null check (char_length(description) between 10 and 1500),
  attachment_path text,
  status text not null default 'new' check (status in ('new','reviewing','resolved','closed')),
  created_at timestamptz not null default now()
);

-- Safe upgrade for projects that ran the earlier portal schema.
alter table public.citizen_reports add column if not exists tracking_number text;
alter table public.citizen_reports add column if not exists latitude double precision;
alter table public.citizen_reports add column if not exists longitude double precision;
update public.citizen_reports set tracking_number = 'KRG-' || to_char(created_at at time zone 'UTC','YYYY') || '-' || upper(substr(replace(id::text,'-',''),1,8)) where tracking_number is null;
alter table public.citizen_reports alter column tracking_number set not null;
create unique index if not exists citizen_reports_tracking_number_uidx on public.citizen_reports(tracking_number);

alter table public.citizen_reports enable row level security;
revoke all on public.citizen_reports from anon, authenticated;
grant insert on public.citizen_reports to anon;
grant select, update (status) on public.citizen_reports to authenticated;
drop policy if exists "Public can submit new citizen reports" on public.citizen_reports;
create policy "Public can submit new citizen reports" on public.citizen_reports for insert to anon with check (status = 'new');
drop policy if exists "Admins can view citizen reports" on public.citizen_reports;
create policy "Admins can view citizen reports" on public.citizen_reports for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
drop policy if exists "Admins can update citizen report status" on public.citizen_reports;
create policy "Admins can update citizen report status" on public.citizen_reports for update to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New citizen report',
  tracking_number text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);
alter table public.admin_notifications enable row level security;
revoke all on public.admin_notifications from anon, authenticated;
grant select, update (is_read) on public.admin_notifications to authenticated;
drop policy if exists "Admins can view notifications" on public.admin_notifications;
create policy "Admins can view notifications" on public.admin_notifications for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');
drop policy if exists "Admins can mark notifications read" on public.admin_notifications;
create policy "Admins can mark notifications read" on public.admin_notifications for update to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create or replace function public.notify_admin_of_citizen_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_notifications (tracking_number) values (new.tracking_number);
  return new;
end;
$$;
drop trigger if exists citizen_report_admin_notification on public.citizen_reports;
create trigger citizen_report_admin_notification after insert on public.citizen_reports for each row execute function public.notify_admin_of_citizen_report();

-- A tracking code plus the submitting email reveals only status, department, and date.
create or replace function public.lookup_citizen_report(p_tracking_number text, p_email text)
returns table (tracking_number text, status text, created_at timestamptz, department text)
language sql security definer set search_path = '' as $$
  select r.tracking_number, r.status, r.created_at, r.department
  from public.citizen_reports as r
  where r.tracking_number = upper(trim(p_tracking_number))
    and lower(coalesce(r.reporter_email,'')) = lower(trim(p_email))
  limit 1;
$$;
revoke all on function public.lookup_citizen_report(text,text) from public, anon, authenticated;
grant execute on function public.lookup_citizen_report(text,text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('citizen-report-attachments', 'citizen-report-attachments', false, 2097152,
        array['image/jpeg','image/png','image/webp','image/gif','image/heic'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Public can upload report attachments" on storage.objects;
create policy "Public can upload report attachments" on storage.objects for insert to anon with check (bucket_id = 'citizen-report-attachments');
drop policy if exists "Admins can view report attachments" on storage.objects;
create policy "Admins can view report attachments" on storage.objects for select to authenticated using (bucket_id = 'citizen-report-attachments' and (auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Private, short-lived hashed-IP counters protect the public AI endpoint from excessive use.
create table if not exists public.citizen_ai_rate_limits (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists citizen_ai_rate_limits_ip_time_idx on public.citizen_ai_rate_limits(ip_hash, created_at desc);
alter table public.citizen_ai_rate_limits enable row level security;
revoke all on public.citizen_ai_rate_limits from public, anon, authenticated;

create or replace function public.claim_citizen_ai_slot(p_ip_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  request_count integer;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_ip_hash)::bigint);
  delete from public.citizen_ai_rate_limits where created_at < pg_catalog.now() - interval '1 day';
  select pg_catalog.count(*) into request_count
    from public.citizen_ai_rate_limits
    where ip_hash = p_ip_hash and created_at > pg_catalog.now() - interval '1 hour';
  if request_count >= 12 then return false; end if;
  insert into public.citizen_ai_rate_limits(ip_hash) values (p_ip_hash);
  return true;
end;
$$;
revoke all on function public.claim_citizen_ai_slot(text) from public, anon, authenticated;
grant execute on function public.claim_citizen_ai_slot(text) to service_role;
