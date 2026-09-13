alter table public.groups add column if not exists pact_promise text;
alter table public.group_members add column if not exists pact_signed_at timestamptz;
update public.group_members set pact_signed_at = joined_at where pact_signed_at is null;