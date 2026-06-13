import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  domain: string | null;
  sso_provider: string | null;
  sso_config: any;
  max_seats: number;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  email?: string;
  name?: string;
}

export interface OrgInvitation {
  id: string;
  org_id: string;
  email: string;
  role: "owner" | "admin" | "member";
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface OrgDomain {
  id: string;
  org_id: string;
  domain: string;
  verified: boolean;
  verification_token: string | null;
  created_at: string;
}

export function useOrganization() {
  const { user } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [domains, setDomains] = useState<OrgDomain[]>([]);
  const [myRole, setMyRole] = useState<"owner" | "admin" | "member" | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrg = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    // Find user's org membership
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      setLoading(false);
      return;
    }

    setMyRole(membership.role as any);

    // Load org, members, invitations, domains in parallel
    const [orgRes, membersRes, invRes, domRes] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", membership.org_id).single(),
      supabase.from("org_members").select("*").eq("org_id", membership.org_id).order("joined_at"),
      supabase.from("org_invitations").select("*").eq("org_id", membership.org_id).is("accepted_at", null).order("created_at", { ascending: false }),
      supabase.from("org_domains").select("*").eq("org_id", membership.org_id).order("created_at"),
    ]);

    if (orgRes.data) setOrg(orgRes.data as any);
    if (membersRes.data) {
      // Enrich members with profile data
      const memberData = membersRes.data as any[];
      const userIds = memberData.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      setMembers(memberData.map((m) => ({
        ...m,
        email: profileMap.get(m.user_id)?.email || "",
        name: profileMap.get(m.user_id)?.name || "",
      })));
    }
    if (invRes.data) setInvitations(invRes.data as any);
    if (domRes.data) setDomains(domRes.data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadOrg(); }, [loadOrg]);

  const createOrg = useCallback(async (name: string, slug: string) => {
    if (!user) return null;
    const { data, error } = await supabase.rpc("create_organization", {
      _name: name,
      _slug: slug,
    });
    if (error) throw error;
    await loadOrg();
    return { id: data };
  }, [user, loadOrg]);

  const updateOrg = useCallback(async (updates: Partial<Organization>) => {
    if (!org) return;
    const { error } = await supabase
      .from("organizations")
      .update(updates)
      .eq("id", org.id);
    if (error) throw error;
    setOrg((prev) => prev ? { ...prev, ...updates } : prev);
  }, [org]);

  const inviteMember = useCallback(async (email: string, role: "admin" | "member") => {
    if (!org || !user) return null;
    const { data, error } = await supabase.functions.invoke("send-org-invitation", {
      body: { email, role, orgId: org.id },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    await loadOrg();
    return data?.invitation;
  }, [org, user, loadOrg]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!org) return;
    const { error } = await supabase.from("org_members").delete().eq("id", memberId);
    if (error) throw error;
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }, [org]);

  const updateMemberRole = useCallback(async (memberId: string, role: "admin" | "member") => {
    if (!org) return;
    const { error } = await supabase.from("org_members").update({ role }).eq("id", memberId);
    if (error) throw error;
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role } : m));
  }, [org]);

  const cancelInvitation = useCallback(async (invId: string) => {
    if (!org) return;
    const { error } = await supabase.from("org_invitations").delete().eq("id", invId);
    if (error) throw error;
    setInvitations((prev) => prev.filter((i) => i.id !== invId));
  }, [org]);

  const addDomain = useCallback(async (domain: string) => {
    if (!org) return;
    const { error } = await supabase.from("org_domains").insert({ org_id: org.id, domain });
    if (error) throw error;
    await loadOrg();
  }, [org, loadOrg]);

  const removeDomain = useCallback(async (domainId: string) => {
    if (!org) return;
    const { error } = await supabase.from("org_domains").delete().eq("id", domainId);
    if (error) throw error;
    setDomains((prev) => prev.filter((d) => d.id !== domainId));
  }, [org]);

  const isAdmin = myRole === "owner" || myRole === "admin";

  return {
    org, members, invitations, domains, myRole, isAdmin, loading,
    createOrg, updateOrg, inviteMember, removeMember, updateMemberRole,
    cancelInvitation, addDomain, removeDomain, reload: loadOrg,
  };
}
