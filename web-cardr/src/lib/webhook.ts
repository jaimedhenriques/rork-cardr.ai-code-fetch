export type WebhookType = "zapier" | "make" | "n8n";

export type WebhookEvent =
  | "contact.created"
  | "contact.updated"
  | "note.created"
  | "meeting.transcribed"
  | "follow_up.due";

export const WEBHOOK_EVENTS: { id: WebhookEvent; label: string; description: string; sample: Record<string, any> }[] = [
  {
    id: "contact.created",
    label: "Contact created",
    description: "Fires when a new contact is added",
    sample: {
      id: "c_abc123",
      name: "Jane Doe",
      company: "Acme Corp",
      title: "VP of Sales",
      email: "jane@acme.com",
      phone: "+1 555 123 4567",
      linkedin: "https://linkedin.com/in/janedoe",
      website: "https://acme.com",
      location: "San Francisco, CA",
      industry: "SaaS",
      companySize: "51-200",
      source: "scan",
    },
  },
  {
    id: "contact.updated",
    label: "Contact updated",
    description: "Fires on any contact field change",
    sample: {
      id: "c_abc123",
      changes: { title: "Chief Revenue Officer", followUpDate: "2026-05-01T09:00:00.000Z" },
    },
  },
  {
    id: "note.created",
    label: "Note created",
    description: "Fires when a meeting note is saved",
    sample: {
      id: "n_xyz789",
      title: "Discovery call — Acme",
      hasTranscript: true,
      manualNotes: null,
      durationSeconds: 1820,
      source: "voice",
    },
  },
  {
    id: "meeting.transcribed",
    label: "Meeting transcribed",
    description: "Fires when a recording finishes transcription",
    sample: {
      id: "n_xyz789",
      title: "Discovery call — Acme",
      transcript: "Thanks for jumping on. So tell me more about your current workflow...",
      durationSeconds: 1820,
      summary: "Acme is evaluating CRMs to replace HubSpot. Decision by Q3.",
    },
  },
  {
    id: "follow_up.due",
    label: "Follow-up due",
    description: "Fires when a contact follow-up date is reached",
    sample: {
      id: "c_abc123",
      name: "Jane Doe",
      company: "Acme Corp",
      email: "jane@acme.com",
      followUpDate: "2026-04-19T09:00:00.000Z",
      nextStep: "Send pricing deck and book demo",
    },
  },
];

export const buildPayloadSchema = (events: WebhookEvent[]) => {
  const wrap = (eventId: WebhookEvent, data: Record<string, any>) => ({
    event: eventId,
    timestamp: "2026-04-19T12:34:56.000Z",
    source: "Card ScanPro",
    data,
  });
  const list = WEBHOOK_EVENTS.filter((e) => events.includes(e.id));
  if (list.length === 0) return "// No events enabled — toggle at least one trigger event above.";
  if (list.length === 1) return JSON.stringify(wrap(list[0].id, list[0].sample), null, 2);
  return list.map((e) => `// ${e.id}\n${JSON.stringify(wrap(e.id, e.sample), null, 2)}`).join("\n\n");
};

const DEFAULT_EVENTS: WebhookEvent[] = ["contact.created"];

const URL_KEYS: Record<WebhookType, string> = {
  zapier: "cardscanpro_zapier_webhook",
  make: "cardscanpro_make_webhook",
  n8n: "cardscanpro_n8n_webhook",
};

const EVENT_KEYS: Record<WebhookType, string> = {
  zapier: "cardscanpro_zapier_events",
  make: "cardscanpro_make_events",
  n8n: "cardscanpro_n8n_events",
};

export const getWebhookUrl = (type: WebhookType): string | null => {
  try {
    return localStorage.getItem(URL_KEYS[type]);
  } catch {
    return null;
  }
};

export const setWebhookUrl = (type: WebhookType, url: string | null) => {
  try {
    if (url) localStorage.setItem(URL_KEYS[type], url);
    else localStorage.removeItem(URL_KEYS[type]);
  } catch {}
};

export const getWebhookEvents = (type: WebhookType): WebhookEvent[] => {
  try {
    const raw = localStorage.getItem(EVENT_KEYS[type]);
    if (!raw) return DEFAULT_EVENTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as WebhookEvent[];
    return DEFAULT_EVENTS;
  } catch {
    return DEFAULT_EVENTS;
  }
};

export const setWebhookEvents = (type: WebhookType, events: WebhookEvent[]) => {
  try {
    localStorage.setItem(EVENT_KEYS[type], JSON.stringify(events));
  } catch {}
};

export const triggerWebhooks = async (event: WebhookEvent, data: Record<string, any>) => {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    source: "Card ScanPro",
    data,
  };

  const types: WebhookType[] = ["zapier", "make", "n8n"];
  const triggers: Promise<void>[] = [];

  for (const type of types) {
    const url = getWebhookUrl(type);
    if (!url) continue;
    const events = getWebhookEvents(type);
    if (!events.includes(event)) continue;
    triggers.push(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify(payload),
      })
        .then(() => console.log(`${type} webhook triggered: ${event}`))
        .catch((err) => console.error(`${type} webhook failed (${event}):`, err))
    );
  }

  await Promise.allSettled(triggers);
};
