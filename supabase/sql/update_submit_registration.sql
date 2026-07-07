-- Guardian Connect: extend submit_registration with weight + dietary_constraints.
--
-- Prerequisite: public.child_medical_info already has the columns
--   weight float8, dietary_constraints jsonb
-- (added out of band). This file only replaces the RPC that writes to them.
--
-- Run once against the project's Postgres database. Safe to re-run.
--
-- The old 12-arg signature is dropped first: adding parameters changes the
-- function's identity, so `create or replace` alone would leave the old
-- signature callable as a stale overload instead of replacing it.

drop function if exists public.submit_registration(
  text, text, text, text, text, text, date, text, text, text, jsonb, text
);

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
  c_weight float8,
  c_dietary_constraints jsonb,
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
  v_dietary_constraint jsonb;
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

  if c_weight is null or c_weight <= 0 then
    raise exception 'invalid weight: must be a positive number' using errcode = '23514';
  end if;

  if m_medications is not null then
    for v_medication in select * from jsonb_array_elements(m_medications)
    loop
      if coalesce(trim(v_medication ->> 'name'), '') = '' then
        raise exception 'invalid medication: name is required' using errcode = '23514';
      end if;
    end loop;
  end if;

  if c_dietary_constraints is not null then
    for v_dietary_constraint in select * from jsonb_array_elements(c_dietary_constraints)
    loop
      if coalesce(trim(v_dietary_constraint ->> 'name'), '') = '' then
        raise exception 'invalid dietary constraint: name is required' using errcode = '23514';
      end if;
      if coalesce(jsonb_array_length(v_dietary_constraint -> 'cannotEat'), 0) = 0 then
        raise exception 'invalid dietary constraint: at least one food is required' using errcode = '23514';
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

  insert into public.child_medical_info (
    child_id, condition, medications, weight, dietary_constraints
  )
  values (
    v_child_id, m_condition, coalesce(m_medications, '[]'::jsonb),
    c_weight, coalesce(c_dietary_constraints, '[]'::jsonb)
  );

  return v_child_id;
end;
$$;

revoke all on function public.submit_registration(
  text, text, text, text, text, text, date, text, text, text, jsonb, float8, jsonb, text
) from public;
revoke execute on function public.submit_registration(
  text, text, text, text, text, text, date, text, text, text, jsonb, float8, jsonb, text
) from anon, authenticated;
grant execute on function public.submit_registration(
  text, text, text, text, text, text, date, text, text, text, jsonb, float8, jsonb, text
) to service_role;
