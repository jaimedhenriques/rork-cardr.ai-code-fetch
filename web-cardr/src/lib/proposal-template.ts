// Branded HTML proposal template generator
// Takes structured AI output + branding tokens and renders polished proposal HTML.

export interface ProposalSection {
  heading: string;
  body: string; // markdown-lite (paragraphs separated by blank lines, lines starting with "- " become bullets)
}

export interface PricingRow {
  label: string;
  amount: string;
  note?: string;
}

export interface TimelineItem {
  milestone: string;
  duration: string;
  deliverables?: string;
}

export interface ProposalContent {
  title: string;
  client_name: string;
  client_company?: string;
  project_type: string;
  overview: string;
  sections: ProposalSection[];
  pricing: PricingRow[];
  pricing_total?: string;
  timeline: TimelineItem[];
  cta_label: string;
  cta_note?: string;
}

export interface ProposalBranding {
  appName: string;
  tagline: string;
  logoUrl: string | null;
  primaryColor: string; // HSL string e.g. "217 91% 60%"
  accentColor: string;
  senderName?: string;
  senderEmail?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const renderBody = (md: string) => {
  const blocks = md.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim());
      if (lines.every((l) => l.startsWith("- ") || l.startsWith("• "))) {
        return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^[-•]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${escapeHtml(block)}</p>`;
    })
    .join("");
};

export const renderProposalHTML = (content: ProposalContent, branding: ProposalBranding): string => {
  const primary = `hsl(${branding.primaryColor})`;
  const accent = `hsl(${branding.accentColor})`;
  const primarySoft = `hsl(${branding.primaryColor} / 0.08)`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(content.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a1a; background: #f8f7f4; line-height: 1.6; }
  .page { max-width: 800px; margin: 0 auto; background: #fff; padding: 56px 64px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.04); }
  header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 24px; border-bottom: 2px solid ${primarySoft}; margin-bottom: 40px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 36px; width: auto; }
  .brand-name { font-weight: 700; font-size: 18px; color: ${primary}; }
  .meta { text-align: right; font-size: 12px; color: #666; }
  h1 { font-size: 32px; margin: 0 0 8px; color: ${primary}; letter-spacing: -0.02em; }
  .subtitle { font-size: 16px; color: #555; margin-bottom: 32px; }
  h2 { font-size: 20px; margin: 36px 0 12px; color: #111; position: relative; padding-left: 14px; }
  h2::before { content: ''; position: absolute; left: 0; top: 8px; width: 4px; height: 20px; background: ${accent}; border-radius: 2px; }
  p { margin: 0 0 12px; }
  ul { padding-left: 20px; margin: 0 0 16px; }
  li { margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0 8px; }
  th, td { text-align: left; padding: 12px 14px; border-bottom: 1px solid #eee; font-size: 14px; }
  th { background: ${primarySoft}; color: ${primary}; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
  .total-row td { font-weight: 700; font-size: 16px; border-bottom: none; padding-top: 18px; }
  .total-row td:last-child { color: ${primary}; }
  .timeline-item { display: flex; gap: 16px; padding: 14px 0; border-bottom: 1px solid #f0f0f0; }
  .timeline-num { flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; background: ${primary}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }
  .timeline-body { flex: 1; }
  .timeline-milestone { font-weight: 600; color: #111; }
  .timeline-duration { font-size: 12px; color: ${primary}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .cta { margin: 48px 0 24px; padding: 28px; background: ${primarySoft}; border-radius: 12px; text-align: center; }
  .cta-button { display: inline-block; padding: 14px 32px; background: ${primary}; color: white; font-weight: 600; border-radius: 8px; text-decoration: none; font-size: 15px; }
  .cta-note { margin-top: 12px; font-size: 13px; color: #666; }
  footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999; }
  @media print { body { background: white; } .page { box-shadow: none; padding: 24px; } }
</style>
</head>
<body>
  <div class="page">
    <header>
      <div class="brand">
        ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.appName)}" />` : ""}
        <span class="brand-name">${escapeHtml(branding.appName)}</span>
      </div>
      <div class="meta">
        <div>Proposal</div>
        <div>${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
      </div>
    </header>

    <h1>${escapeHtml(content.title)}</h1>
    <div class="subtitle">Prepared for <strong>${escapeHtml(content.client_name)}</strong>${content.client_company ? ` · ${escapeHtml(content.client_company)}` : ""}</div>

    <h2>Overview</h2>
    ${renderBody(content.overview)}

    ${content.sections
      .map(
        (s) => `
      <h2>${escapeHtml(s.heading)}</h2>
      ${renderBody(s.body)}
    `
      )
      .join("")}

    <h2>Investment</h2>
    <table>
      <thead>
        <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
      </thead>
      <tbody>
        ${content.pricing
          .map(
            (p) => `<tr>
              <td>${escapeHtml(p.label)}${p.note ? `<div style="color:#888;font-size:12px;margin-top:2px">${escapeHtml(p.note)}</div>` : ""}</td>
              <td style="text-align:right">${escapeHtml(p.amount)}</td>
            </tr>`
          )
          .join("")}
        ${content.pricing_total ? `<tr class="total-row"><td>Total</td><td style="text-align:right">${escapeHtml(content.pricing_total)}</td></tr>` : ""}
      </tbody>
    </table>

    <h2>Timeline</h2>
    ${content.timeline
      .map(
        (t, i) => `
      <div class="timeline-item">
        <div class="timeline-num">${i + 1}</div>
        <div class="timeline-body">
          <div class="timeline-milestone">${escapeHtml(t.milestone)}</div>
          <div class="timeline-duration">${escapeHtml(t.duration)}</div>
          ${t.deliverables ? `<div style="font-size:14px;color:#555;margin-top:4px">${escapeHtml(t.deliverables)}</div>` : ""}
        </div>
      </div>
    `
      )
      .join("")}

    <div class="cta">
      <a href="#" class="cta-button">${escapeHtml(content.cta_label)}</a>
      ${content.cta_note ? `<div class="cta-note">${escapeHtml(content.cta_note)}</div>` : ""}
    </div>

    <footer>
      ${branding.senderName ? `<div>${escapeHtml(branding.senderName)}${branding.senderEmail ? ` · ${escapeHtml(branding.senderEmail)}` : ""}</div>` : ""}
      <div style="margin-top:6px">${escapeHtml(branding.appName)} — ${escapeHtml(branding.tagline)}</div>
    </footer>
  </div>
</body>
</html>`;
};
