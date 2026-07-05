-- Guardian Connect: child registration write path.
-- Run once against the project's Postgres database (Supabase SQL editor or
-- `supabase db push` if wired into migrations). Safe to re-run: every
-- statement is idempotent.
--
-- Access model:
--   - anon / authenticated: zero privileges on these tables, ever. Reads and
--     writes only happen through submit_registration, executed by the
--     Edge Function with the service_role key.
--   - service_role: EXECUTE on submit_registration only. It does not need
--     direct table grants because the function runs SECURITY DEFINER as
--     its owner.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name text not null check (char_length(trim(last_name)) > 0),
  identity_document_num text not null
    check (char_length(trim(identity_document_num)) between 5 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name text not null check (char_length(trim(last_name)) > 0),
  identity_document_num text not null
    check (char_length(trim(identity_document_num)) between 5 and 20),
  birthdate date not null check (birthdate < current_date),
  -- Assumes the client normalized the number first (digits + optional leading
  -- "+", per PRD section 6): local 04xxxxxxxxx or +58/58 4xxxxxxxxx.
  phone_number text not null check (phone_number ~ '^(\+58|0)?4[0-9]{9}$'),
  residence_zone text not null check (char_length(trim(residence_zone)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.child_medical_info (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  condition text,
  medications jsonb not null default '[]'::jsonb
    check (jsonb_typeof(medications) = 'array'),
  created_at timestamptz not null default now()
);

create schema if not exists private;

create table if not exists private.rate_limits (
  id bigserial primary key,
  ip_address text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limits_ip_created_idx
  on private.rate_limits (ip_address, created_at);

-- ---------------------------------------------------------------------------
-- Lock everything down: RLS with no policies + explicit revokes from the
-- client-facing roles. Only a SECURITY DEFINER function (or a role with
-- BYPASSRLS, e.g. service_role/postgres) can touch these tables.
-- ---------------------------------------------------------------------------

alter table public.guardians enable row level security;
alter table public.children enable row level security;
alter table public.child_medical_info enable row level security;

revoke all on public.guardians from anon, authenticated;
revoke all on public.children from anon, authenticated;
revoke all on public.child_medical_info from anon, authenticated;

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_registration: the only write path into the above tables.
-- Called exclusively by the Edge Function via the service_role key.
-- ---------------------------------------------------------------------------

create or replace function public.submit_registration(
  g_first_name text,
  g_last_name text,
  g_identity_doc text,
  c_first_name text,
  c_last_name text,
  c_identity_doc text,
  c_birthdate date,
  c_phone text,
  c_zone text,
  m_condition text,
  m_medications jsonb,
  p_client_ip text
) returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_guardian_id uuid;
  v_child_id uuid;
  v_recent_count integer;
  v_medication jsonb;
  v_rate_limit_window constant interval := interval '5 minutes';
  v_rate_limit_max constant integer := 15;
begin
  if p_client_ip is not null then
    -- Opportunistic cleanup so this table doesn't grow unbounded.
    delete from private.rate_limits where created_at < now() - interval '1 hour';

    select count(*) into v_recent_count
    from private.rate_limits
    where ip_address = p_client_ip
      and created_at > now() - v_rate_limit_window;

    if v_recent_count >= v_rate_limit_max then
      raise exception 'rate limit exceeded for ip %', p_client_ip;
    end if;

    insert into private.rate_limits (ip_address) values (p_client_ip);
  end if;

  if m_medications is not null then
    for v_medication in select * from jsonb_array_elements(m_medications)
    loop
      if coalesce(trim(v_medication ->> 'name'), '') = '' then
        raise exception 'invalid medication: name is required' using errcode = '23514';
      end if;
    end loop;
  end if;

  insert into public.guardians (first_name, last_name, identity_document_num)
  values (g_first_name, g_last_name, g_identity_doc)
  returning id into v_guardian_id;

  insert into public.children (
    guardian_id, first_name, last_name, identity_document_num,
    birthdate, phone_number, residence_zone
  )
  values (
    v_guardian_id, c_first_name, c_last_name, c_identity_doc,
    c_birthdate, c_phone, c_zone
  )
  returning id into v_child_id;

  insert into public.child_medical_info (child_id, condition, medications)
  values (v_child_id, m_condition, coalesce(m_medications, '[]'::jsonb));

  return v_child_id;
end;
$$;

revoke all on function public.submit_registration from public;
revoke execute on function public.submit_registration from anon, authenticated;
grant execute on function public.submit_registration to service_role;
