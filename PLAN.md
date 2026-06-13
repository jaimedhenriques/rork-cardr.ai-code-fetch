# Bring the iOS app to full parity with Cardr.ai — drawer menu, real scanning, enrichment, full CRM & more

The goal: make the native iOS app match the original Cardr.ai web app in design and functionality — every feature, no hidden/"coming soon" gates. I'll build this in phases and check in as each lands.

## Phase 1 — The "left banner" menu & navigation ✅
- [x] Add a slide-out **left drawer menu** opened from a button in the top-left, matching the web app.
- [x] Organised into three sections, exactly like the web:
  - **Main**: Home, Scan Badge, Notes, AI Chat, Agents
  - **CRM**: Contacts, Leads, Activity, Calendar, Events, Export
  - **Profile**: My Card, Admin Panel, Settings
- Shows your profile photo, name and email at the top; Send Feedback and Sign Out at the bottom.
- Keep the existing bottom tab bar for quick access; the drawer reaches everything else.
- Active item highlighting, smooth spring slide-in, dim background, and haptic taps.

## Phase 2 — Real badge & card scanning ✅
- [x] Build a real camera scanner that reads a business card / event badge and turns it into a contact automatically.
- Capture from the **camera** or pick an existing **photo from the library** (so it works everywhere, including preview).
- After capture: text is read on-device, the contact is saved instantly, then **enriched with AI in the background** (company, role, location, links).
- Clean placeholder only when no camera exists, with the photo-import path always available.

## Phase 3 — Data enrichment everywhere ✅
- [x] Add an **Enrich** action on each contact that fills in verified details (LinkedIn, website, location, industry, company size, phone, avatar).
- [x] Add **Enrich All** with a live progress bar to enrich your whole list in one go.
- [x] Show an "Enriched" badge on contacts and in the contact detail, matching the web.

## Phase 4 — Full CRM ✅
- [x] **Contacts**: rich filtering (search, source, event, missing-info, enrichment status, tags), bulk actions (select multiple, tag, delete, export, enrich), duplicate detection.
- [x] **Leads / Pipeline**: full stage board (lead stages, move contacts between stages, per-stage summary), stage management.
- [x] **Activity**: a timeline/analytics view of recent contact activity.
- [x] Email composer and quick actions (call, email, text) from a contact.

## Phase 5 — Events & Calendar (complete) ✅
- [x] Bring Events up to the web version: event dashboard, event detail with attendees, AI event enrichment, and the calendar plotting events.

## Phase 6 — AI Chat assistant (full power) ✅
- [x] Upgrade the chatbot so it can actually do things by command: search, create/update/delete contacts, enrich contacts (single, batch, or all), manage leads/stages, and more — like the web assistant.

## Phase 7 — The remaining web features (no native gating) ✅
- [x] **Agents**: live agents list (installed + templates, install/pause/remove) + agent detail.
- [x] **Automations**: outreach sequences + runs, backed by the live tables.
- [x] **Integrations**: categorized connection catalog (Zapier, Pipedream, webhooks, CRMs, etc.).
- [x] **Analytics**: meeting-insight dashboard (sentiment, questions, engagement, top speakers).
- [x] **Admin Panel**: account overview + live usage.
- **Referrals**: intentionally omitted on native — the web app hides referral/credit surfaces on iOS for App Store compliance, so matching that behavior is correct parity.
- [x] **My Card branding**: deeper white-label editor (app name, tagline, brand colors, logo/favicon/splash uploads) with live preview, shown in the Admin Panel for org owners/admins — matching the web `BrandingEditor`.

## Phase 8 — Final parity polish ✅
- [x] **Contact import**: CSV & VCF/vCard import with file picker, header detection, preview/selection, event-folder mapping (auto from CSV / existing / new), and merge-vs-skip duplicate handling — matching the web `ContactImportModal`.
- [x] **Command palette (⌘K)**: global quick switcher with search, grouped navigation, quick actions, and sign out — opened via the hardware ⌘K shortcut or the drawer button, matching the web `CommandPalette`.
- [x] **Live white-label theming**: saved org branding colors now restyle the whole app dynamically (primary/accent/brand gradient), mirroring the web `BrandingContext`. Built-in palette restored when an org has no custom branding.
- [x] **Importer on empty state**: the empty Contacts screen now offers "Import from CSV or vCard" alongside "Add contact".
- [x] **Delete account**: full multi-step deletion flow (warning → safety checklist → password re-auth → type-DELETE confirm → animated phase progress) calling the `delete-account` function, matching the web `DeleteAccount` page (and App Store requirement).
- [x] **Settings setup rows**: Import contacts and Integrations are now live (no longer "Upcoming").

## Design
- Match the web app's look and feel: same color theme, rounded cards, soft shadows, gradient brand accents, and the same iconography, adapted to feel native on iOS (system fonts, native controls, glass/blur surfaces, smooth animations and haptics).

## Notes
- I'll keep everything pointed at your existing live backend so data stays in sync with the web app.
- I'll validate the build after each phase. This is large — I'll work through the phases in order and report changed screens and build results as I go.
- Nothing will be published, submitted to the App Store, or charged; no account/security or external credentials are touched.

Want me to start at Phase 1 (the left drawer menu) and work straight through?