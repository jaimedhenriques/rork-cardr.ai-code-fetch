import { Link } from "react-router-dom";

const LAST_UPDATED = "May 26, 2026";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back to Cardr
        </Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-neutral mt-8 max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold">Who we are</h2>
            <p>
              Cardr ("we", "us") provides a business-card scanner, AI note-taker, and lead
              management app at cardr.ai. This policy explains what data we collect, why, and
              how you control it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Data we collect</h2>
            <ul className="list-disc pl-6">
              <li><strong>Account:</strong> email, name, password hash, sign-in provider.</li>
              <li><strong>Contacts you scan or create:</strong> names, emails, phones, company, role, notes, photos of cards.</li>
              <li><strong>Meeting notes:</strong> text you write and, if you opt in, audio you record for transcription.</li>
              <li><strong>Usage data:</strong> minimal device and app-event logs to keep the service running and debug crashes.</li>
              <li><strong>Billing:</strong> handled by Stripe; we never see your card number.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">How we use it</h2>
            <ul className="list-disc pl-6">
              <li>Provide the scan, transcription, enrichment, and export features you request.</li>
              <li>Sync your data across your devices.</li>
              <li>Send service emails (receipts, security alerts). Marketing only if you opt in.</li>
              <li>Improve reliability and prevent abuse.</li>
            </ul>
            <p>We do not sell your data and do not use it to train third-party AI models.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">AI processing</h2>
            <p>
              Card images, transcripts, and prompts you submit to AI features are sent to our
              AI providers (Google, OpenAI) strictly to return the result to you. Providers are
              contractually barred from training on your content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Sharing</h2>
            <p>
              We share data only with infrastructure providers needed to run the app
              (hosting, database, email, payments, AI). A current list is available on request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Your rights</h2>
            <ul className="list-disc pl-6">
              <li>Access, export, or correct your data from Settings.</li>
              <li>Delete your account and all associated data at any time via Settings → Delete account.</li>
              <li>Contact <a className="text-primary underline" href="mailto:privacy@cardr.ai">privacy@cardr.ai</a> for any GDPR/CCPA request.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Retention</h2>
            <p>
              We keep your data while your account is active. On deletion, content is removed
              within 30 days, except where law requires us to retain billing records.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Children</h2>
            <p>Cardr is not directed to children under 13 and we do not knowingly collect their data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Contact</h2>
            <p>
              Questions? Email <a className="text-primary underline" href="mailto:privacy@cardr.ai">privacy@cardr.ai</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
