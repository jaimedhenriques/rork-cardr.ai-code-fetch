alter table public.custom_note_templates
  add column if not exists org_id uuid references public.organizations(id) on delete set null,
  add column if not exists is_shared boolean not null default false;

create or replace function public.is_org_member(_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = _org_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

drop policy if exists tpl_select_own on public.custom_note_templates;
create policy tpl_select_own on public.custom_note_templates
  for select using (
    auth.uid() = user_id
    or (is_shared and org_id is not null and public.is_org_member(org_id))
  );

drop policy if exists tpl_insert_own on public.custom_note_templates;
create policy tpl_insert_own on public.custom_note_templates
  for insert with check (
    auth.uid() = user_id
    and (org_id is null or public.is_org_member(org_id))
  );

drop policy if exists tpl_update_own on public.custom_note_templates;
create policy tpl_update_own on public.custom_note_templates
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (org_id is null or public.is_org_member(org_id))
  );

create index if not exists idx_tpl_org_shared
  on public.custom_note_templates (org_id)
  where is_shared;
