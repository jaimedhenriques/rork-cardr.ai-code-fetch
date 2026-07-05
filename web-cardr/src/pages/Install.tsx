import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Zap, ScanLine, Download } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import InstallAppCard from "@/components/InstallAppCard";

export default function Install() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto px-5 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30">
            <Download size={28} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Install Cardr on your phone</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Add Cardr to your home screen for one-tap access. The native iOS and Android apps
            are coming to the App Store and Play Store soon.
          </p>
        </motion.div>

        <InstallAppCard className="mb-6" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-5 mb-6"
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Why install?
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <ScanLine size={16} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Open straight to the scanner</p>
                <p className="text-[11px] text-muted-foreground">Tap once, capture a badge — no browser address bar.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Zap size={16} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Faster on every launch</p>
                <p className="text-[11px] text-muted-foreground">Runs full-screen with native-style transitions.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Sparkles size={16} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">All features, none of the wait</p>
                <p className="text-[11px] text-muted-foreground">Same Cardr, just feels like a real app.</p>
              </div>
            </li>
          </ul>
        </motion.div>

        <p className="text-center text-[11px] text-muted-foreground mb-2">
          On a computer?{" "}
          <Link to="/desktop" className="text-primary font-semibold hover:underline">
            Set up meeting recording on desktop
          </Link>
        </p>
        <p className="text-center text-[11px] text-muted-foreground">
          Already a customer?{" "}
          <Link to="/app" className="text-primary font-semibold hover:underline">
            Open the dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
