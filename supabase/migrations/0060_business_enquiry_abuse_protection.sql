-- 0060: Protect public business enquiries from automated abuse.
-- Stores only a one-way hash of the client IP key and enforces 5 submissions
-- per 15-minute window. Only the server service role can call the limiter.

create table if not exists public.business_enquiry_rate_limits (
  client_key_hash text primary key
    check (client_key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
    check (request_count >= 0)
);

alter table public.business_enquiry_rate_limits enable row level security;
revoke all on public.business_enquiry_rate_limits from public, anon, authenticated, service_role;

create or replace function public.consume_business_enquiry_rate_limit(
  p_client_key_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  if p_client_key_hash is null
     or p_client_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate limit key.';
  end if;

  insert into public.business_enquiry_rate_limits (
    client_key_hash, window_started_at, request_count
  )
  values (p_client_key_hash, now(), 1)
  on conflict (client_key_hash) do update
  set
    request_count = case
      when public.business_enquiry_rate_limits.window_started_at <= now() - interval '15 minutes'
        then 1
      else public.business_enquiry_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.business_enquiry_rate_limits.window_started_at <= now() - interval '15 minutes'
        then now()
      else public.business_enquiry_rate_limits.window_started_at
    end
  returning request_count into v_count;

  delete from public.business_enquiry_rate_limits
  where window_started_at < now() - interval '2 days';

  return v_count <= 5;
end;
$function$;

revoke all on function public.consume_business_enquiry_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_business_enquiry_rate_limit(text) to service_role;

comment on function public.consume_business_enquiry_rate_limit(text) is
  'Atomically allows at most five public business enquiries per hashed client IP in a rolling fixed 15-minute window; service-role only.';
