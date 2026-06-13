import { supabase } from "@/integrations/supabase/client";

export type WebhookEvent =
  | "note.created"
  | "note.updated"
  | "note.deleted"
  | "contact.created"
  | "contact.updated"
  | "contact.deleted"
  | "follow_up.due"
  | "action_item.created";

export const WEBHOOK_EVENTS: { value: WebhookEvent; label: string; description: string }[] = [
  { value: "note.created", label: "Note created", description: "Fires when a new meeting note is saved." },
  { value: "note.updated", label: "Note updated", description: "Fires when a note's content or AI summary changes." },
  { value: "note.deleted", label: "Note deleted", description: "Fires when a note is deleted." },
  { value: "contact.created", label: "Contact created", description: "Fires when a new contact is added or scanned." },
  { value: "contact.updated", label: "Contact updated", description: "Fires when contact details change or get enriched." },
  { value: "contact.deleted", label: "Contact deleted", description: "Fires when a contact is removed." },
  { value: "follow_up.due", label: "Follow-up due", description: "Fires when a contact's follow-up date is reached." },
  { value: "action_item.created", label: "Action item created", description: "Fires when AI extracts a new action item from a note." },
];

/** Fire-and-forget. Never throws. */
export async function fireWebhook(event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
  try {
    await supabase.functions.invoke("dispatch-webhook", { body: { event, payload } });
  } catch (err) {
    // Silent — webhooks must never break the app
    console.warn("[webhooks] dispatch failed", err);
  }
}
