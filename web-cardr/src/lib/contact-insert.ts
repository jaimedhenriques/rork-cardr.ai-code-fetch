// Row builder for authenticated contact insertion.
//
// Kept separate from AppContext so the column mapping — in particular the
// pipeline stage, which capture now sets — can be asserted directly in tests.

export interface ContactInsertSource {
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  avatar?: string;
  folderId?: string;
  notes?: string;
  linkedin?: string;
  website?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  enriched?: boolean;
  enrichedAt?: string;
  stageId?: string;
  scannedAt: string;
}

export interface ContactInsertRow {
  user_id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  avatar?: string;
  folder_id: string | null;
  notes?: string;
  linkedin?: string;
  website?: string;
  location?: string;
  industry?: string;
  company_size?: string;
  enriched: boolean;
  enriched_at: string | null;
  stage_id: string | null;
  scanned_at: string;
}

export function buildContactInsert(
  userId: string,
  c: ContactInsertSource,
): ContactInsertRow {
  return {
    user_id: userId,
    name: c.name,
    company: c.company,
    title: c.title,
    email: c.email,
    phone: c.phone,
    avatar: c.avatar,
    folder_id: c.folderId || null,
    notes: c.notes,
    linkedin: c.linkedin,
    website: c.website,
    location: c.location,
    industry: c.industry,
    company_size: c.companySize,
    enriched: c.enriched || false,
    enriched_at: c.enrichedAt || null,
    stage_id: c.stageId || null,
    scanned_at: c.scannedAt,
  };
}
