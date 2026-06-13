import { Link } from "react-router-dom";

const Support = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back to Cardr
        </Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">Support</h1>
        <p className="mt-3 text-muted-foreground">
          We're a small team and we read every message.
        </p>

        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Email us</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Typical response time: under 24 hours on business days.
            </p>
            <a
              href="mailto:support@cardr.ai"
              className="mt-3 inline-block text-primary underline"
            >
              support@cardr.ai
            </a>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Account & billing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your subscription at <span className="font-medium">cardr.ai</span> in any browser.
              Plan changes sync back to the app automatically.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Privacy</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              See our <Link to="/privacy" className="text-primary underline">privacy policy</Link> or
              email <a href="mailto:privacy@cardr.ai" className="text-primary underline">privacy@cardr.ai</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
