-- Fix schema defect + missing RPC first
alter table public.organizations alter column created_by type uuid using null::uuid;

create or replace function public.create_organization(_name text, _slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  _org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.organizations (name, slug, created_by)
  values (trim(_name), lower(trim(_slug)), auth.uid())
  returning id into _org_id;
  insert into public.org_members (org_id, user_id, role)
  values (_org_id, auth.uid(), 'owner');
  return _org_id;
end;
$fn$;

revoke execute on function public.create_organization(text, text) from anon, public;
grant execute on function public.create_organization(text, text) to authenticated;

-- RLS policy fix: client-facing tables had RLS enabled with zero policies,
-- silently blocking all reads/writes through the API.
-- Service-role-only tables (ci_*, email_*, referral_clicks, sent_reminders,
-- suppressed_emails, transactional_emails, typecheck_run_audit) stay locked.

-- ---------- profiles: own row + platform admin read ----------
drop policy if exists own_select_profiles on public.profiles;
create policy own_select_profiles on public.profiles
  for select using (auth.uid() = id);
drop policy if exists own_insert_profiles on public.profiles;
create policy own_insert_profiles on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists own_update_profiles on public.profiles;
create policy own_update_profiles on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists admin_select_profiles on public.profiles;
create policy admin_select_profiles on public.profiles
  for select using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

-- ---------- contact_tags: via parent contact ownership ----------
drop policy if exists own_all_contact_tags on public.contact_tags;
create policy own_all_contact_tags on public.contact_tags
  for all
  using (exists (select 1 from public.contacts c where c.id = contact_tags.contact_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.contacts c where c.id = contact_tags.contact_id and c.user_id = auth.uid()));

-- ---------- note_tags: via parent note ownership ----------
drop policy if exists own_all_note_tags on public.note_tags;
create policy own_all_note_tags on public.note_tags
  for all
  using (exists (select 1 from public.meeting_notes n where n.id = note_tags.note_id and n.user_id = auth.uid()))
  with check (exists (select 1 from public.meeting_notes n where n.id = note_tags.note_id and n.user_id = auth.uid()));

-- ---------- organizations ----------
drop policy if exists member_select_organizations on public.organizations;
create policy member_select_organizations on public.organizations
  for select using (
    public.is_org_member(id)
    or created_by = auth.uid()
    or exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid())
  );
drop policy if exists creator_insert_organizations on public.organizations;
create policy creator_insert_organizations on public.organizations
  for insert with check (created_by = auth.uid());
drop policy if exists admin_update_organizations on public.organizations;
create policy admin_update_organizations on public.organizations
  for update using (
    exists (select 1 from public.org_members m
            where m.org_id = organizations.id and m.user_id = auth.uid()
              and m.role in ('owner','admin'))
  );

-- ---------- org_members: members see their whole org; platform admins see all ----------
drop policy if exists org_select_org_members on public.org_members;
create policy org_select_org_members on public.org_members
  for select using (public.is_org_member(org_id));
drop policy if exists admin_select_org_members on public.org_members;
create policy admin_select_org_members on public.org_members
  for select using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

-- ---------- org_invitations: org admins manage ----------
drop policy if exists admin_all_org_invitations on public.org_invitations;
create policy admin_all_org_invitations on public.org_invitations
  for all
  using (exists (select 1 from public.org_members m
                 where m.org_id = org_invitations.org_id and m.user_id = auth.uid()
                   and m.role in ('owner','admin')))
  with check (exists (select 1 from public.org_members m
                      where m.org_id = org_invitations.org_id and m.user_id = auth.uid()
                        and m.role in ('owner','admin')));

-- ---------- org_domains: members read, org admins write ----------
drop policy if exists member_select_org_domains on public.org_domains;
create policy member_select_org_domains on public.org_domains
  for select using (public.is_org_member(org_id));
drop policy if exists admin_insert_org_domains on public.org_domains;
create policy admin_insert_org_domains on public.org_domains
  for insert with check (exists (select 1 from public.org_members m
                                 where m.org_id = org_domains.org_id and m.user_id = auth.uid()
                                   and m.role in ('owner','admin')));
drop policy if exists admin_update_org_domains on public.org_domains;
create policy admin_update_org_domains on public.org_domains
  for update using (exists (select 1 from public.org_members m
                            where m.org_id = org_domains.org_id and m.user_id = auth.uid()
                              and m.role in ('owner','admin')));
drop policy if exists admin_delete_org_domains on public.org_domains;
create policy admin_delete_org_domains on public.org_domains
  for delete using (exists (select 1 from public.org_members m
                            where m.org_id = org_domains.org_id and m.user_id = auth.uid()
                              and m.role in ('owner','admin')));

-- ---------- org_branding: members read, org admins write ----------
drop policy if exists member_select_org_branding on public.org_branding;
create policy member_select_org_branding on public.org_branding
  for select using (public.is_org_member(org_id));
drop policy if exists admin_insert_org_branding on public.org_branding;
create policy admin_insert_org_branding on public.org_branding
  for insert with check (exists (select 1 from public.org_members m
                                 where m.org_id = org_branding.org_id and m.user_id = auth.uid()
                                   and m.role in ('owner','admin')));
drop policy if exists admin_update_org_branding on public.org_branding;
create policy admin_update_org_branding on public.org_branding
  for update using (exists (select 1 from public.org_members m
                            where m.org_id = org_branding.org_id and m.user_id = auth.uid()
                              and m.role in ('owner','admin')));
drop policy if exists admin_delete_org_branding on public.org_branding;
create policy admin_delete_org_branding on public.org_branding
  for delete using (exists (select 1 from public.org_members m
                            where m.org_id = org_branding.org_id and m.user_id = auth.uid()
                              and m.role in ('owner','admin')));

-- ---------- referrals / referral_commissions: own rows + platform admin ----------
drop policy if exists own_select_referrals on public.referrals;
create policy own_select_referrals on public.referrals
  for select using (referrer_id = auth.uid());
drop policy if exists admin_select_referrals on public.referrals;
create policy admin_select_referrals on public.referrals
  for select using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));
drop policy if exists own_select_referral_commissions on public.referral_commissions;
create policy own_select_referral_commissions on public.referral_commissions
  for select using (referrer_id = auth.uid());
drop policy if exists admin_select_referral_commissions on public.referral_commissions;
create policy admin_select_referral_commissions on public.referral_commissions
  for select using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

-- ---------- feature_flags: readable by everyone ----------
drop policy if exists all_select_feature_flags on public.feature_flags;
create policy all_select_feature_flags on public.feature_flags
  for select using (true);

-- ---------- platform_waitlist: anyone can join, nobody can read ----------
drop policy if exists anyone_insert_platform_waitlist on public.platform_waitlist;
create policy anyone_insert_platform_waitlist on public.platform_waitlist
  for insert with check (true);

-- ---------- coupon_codes: platform admins manage (validation runs server-side) ----------
drop policy if exists admin_all_coupon_codes on public.coupon_codes;
create policy admin_all_coupon_codes on public.coupon_codes
  for all
  using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

-- ---------- license_orders: own orders + platform admin ----------
drop policy if exists own_select_license_orders on public.license_orders;
create policy own_select_license_orders on public.license_orders
  for select using (purchased_by = (auth.uid())::text);
drop policy if exists admin_select_license_orders on public.license_orders;
create policy admin_select_license_orders on public.license_orders
  for select using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

-- ---------- typecheck_runs: platform admins read (CI writes via service role) ----------
drop policy if exists admin_select_typecheck_runs on public.typecheck_runs;
create policy admin_select_typecheck_runs on public.typecheck_runs
  for select using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));
