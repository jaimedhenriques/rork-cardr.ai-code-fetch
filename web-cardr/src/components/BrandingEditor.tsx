import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Paintbrush, Upload, Loader2, Image, Type, Palette, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useOrgBranding } from "@/hooks/useOrgBranding";

interface BrandingEditorProps {
  orgId: string;
}

const ColorInput = ({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) => {
  // Convert HSL string "H S% L%" to hex for the color input
  const hslToHex = (hsl: string) => {
    const parts = hsl.split(" ");
    const h = parseInt(parts[0]) || 0;
    const s = parseInt(parts[1]) || 0;
    const l = parseInt(parts[2]) || 0;
    const a = s / 100;
    const b = l / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = b - a * Math.min(b, 1 - b) * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Convert hex to HSL string
  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b2 = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b2), min = Math.min(r, g, b2);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b2) / d + (g < b2 ? 6 : 0)) * 60; break;
        case g: h = ((b2 - r) / d + 2) * 60; break;
        case b2: h = ((r - g) / d + 4) * 60; break;
      }
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-muted-foreground font-medium w-24 shrink-0">{label}</label>
      <input
        type="color"
        value={hslToHex(value)}
        onChange={(e) => onChange(hexToHsl(e.target.value))}
        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
      />
      <span className="text-[10px] text-muted-foreground font-mono">{value}</span>
    </div>
  );
};

const FileUploadButton = ({
  label, onUpload, loading, currentUrl, accept = "image/*",
}: { label: string; onUpload: (file: File) => void; loading: boolean; currentUrl?: string | null; accept?: string }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      {currentUrl && (
        <div className="w-full h-16 rounded-xl bg-secondary/50 flex items-center justify-center overflow-hidden">
          <img src={currentUrl} alt={label} className="max-h-14 max-w-[200px] object-contain" />
        </div>
      )}
      <button
        onClick={() => ref.current?.click()}
        disabled={loading}
        className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {currentUrl ? "Replace" : "Upload"}
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
    </div>
  );
};

const BrandingEditor = ({ orgId }: BrandingEditorProps) => {
  const { branding, loading, saveBranding, uploadAsset } = useOrgBranding(orgId);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [appName, setAppName] = useState("");
  const [tagline, setTagline] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [dirty, setDirty] = useState(false);

  // Sync from branding when loaded
  const syncFields = () => {
    setAppName(branding.app_name);
    setTagline(branding.tagline);
    setPrimaryColor(branding.primary_color);
    setAccentColor(branding.accent_color);
    setDirty(false);
  };

  // Initial sync
  if (!loading && !dirty && appName === "" && branding.app_name) {
    syncFields();
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBranding({
        app_name: appName.trim() || "Cardr",
        tagline: tagline.trim() || "Scan. Remember. Close.",
        primary_color: primaryColor,
        accent_color: accentColor,
      });
      toast.success("Branding saved!");
      setDirty(false);
    } catch { toast.error("Failed to save branding"); }
    finally { setSaving(false); }
  };

  const handleUpload = async (file: File, type: "logo" | "favicon" | "splash") => {
    setUploading(type);
    try {
      await uploadAsset(file, type);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded!`);
    } catch { toast.error(`Failed to upload ${type}`); }
    finally { setUploading(null); }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await saveBranding({
        app_name: "Cardr",
        tagline: "Scan. Remember. Close.",
        primary_color: "217 91% 60%",
        accent_color: "280 80% 60%",
        logo_url: null,
        favicon_url: null,
        splash_url: null,
      });
      syncFields();
      toast.success("Branding reset to default");
    } catch { toast.error("Failed to reset"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 size={16} className="text-primary animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="card-elevated p-4">
        <div className="flex items-center gap-2 mb-3">
          <Paintbrush size={14} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">White-Label Branding</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Customize the app to match your company brand. Members of your organization will see these changes.
        </p>

        {/* App Name & Tagline */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 flex items-center gap-1">
              <Type size={10} /> App Name
            </label>
            <input
              value={appName}
              onChange={(e) => { setAppName(e.target.value); setDirty(true); }}
              placeholder="Cardr"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Tagline</label>
            <input
              value={tagline}
              onChange={(e) => { setTagline(e.target.value); setDirty(true); }}
              placeholder="Scan. Remember. Close."
              className="input-field"
            />
          </div>
        </div>

        {/* Colors */}
        <div className="mb-4">
          <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-2 flex items-center gap-1">
            <Palette size={10} /> Brand Colors
          </label>
          <div className="space-y-2">
            <ColorInput label="Primary" value={primaryColor} onChange={(v) => { setPrimaryColor(v); setDirty(true); }} />
            <ColorInput label="Accent" value={accentColor} onChange={(v) => { setAccentColor(v); setDirty(true); }} />
          </div>
        </div>

        {/* Uploads */}
        <div className="space-y-4 mb-4">
          <div className="flex items-center gap-1 mb-1">
            <Image size={10} className="text-muted-foreground" />
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Assets</label>
          </div>
          <FileUploadButton
            label="Logo (recommended: 200×50 PNG)"
            onUpload={(f) => handleUpload(f, "logo")}
            loading={uploading === "logo"}
            currentUrl={branding.logo_url}
          />
          <FileUploadButton
            label="Favicon (32×32 PNG or ICO)"
            onUpload={(f) => handleUpload(f, "favicon")}
            loading={uploading === "favicon"}
            currentUrl={branding.favicon_url}
          />
          <FileUploadButton
            label="Splash Screen (1080×1920 PNG)"
            onUpload={(f) => handleUpload(f, "splash")}
            loading={uploading === "splash"}
            currentUrl={branding.splash_url}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold text-muted-foreground bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save Branding
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="card-elevated p-4">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-3">Preview</p>
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ backgroundColor: `hsl(${primaryColor} / 0.1)` }}
        >
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="h-10 max-w-[120px] object-contain" />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: `hsl(${primaryColor})` }}
            >
              {appName?.charAt(0) || "C"}
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-foreground">{appName || "Cardr"}</p>
            <p className="text-[10px] text-muted-foreground">{tagline || "Scan. Remember. Close."}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BrandingEditor;
