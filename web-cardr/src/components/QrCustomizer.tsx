import { useState, useRef } from "react";
import { Palette, ImagePlus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

export interface QrStyle {
  fgColor: string;
  bgColor: string;
  logoDataUrl: string | null;
}

const PRESET_COLORS = [
  "#1a1a2e", "#0f172a", "#1e293b", "#374151",
  "#3b82f6", "#2563eb", "#0ea5e9", "#06b6d4",
  "#8b5cf6", "#7c3aed", "#a855f7", "#6366f1",
  "#10b981", "#059669", "#14b8a6", "#22c55e",
  "#f59e0b", "#f97316", "#ef4444", "#ec4899",
  "#ffffff", "#f5f1eb", "#fafaf9", "#f1f5f9",
];

interface QrCustomizerProps {
  style: QrStyle;
  onChange: (style: QrStyle) => void;
}

const QrCustomizer = ({ style, onChange }: QrCustomizerProps) => {
  const [activeTab, setActiveTab] = useState<"fg" | "bg" | "logo">("fg");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 500_000) {
      toast.error("Logo must be under 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...style, logoDataUrl: reader.result as string });
      toast.success("Logo added to QR code");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleReset = () => {
    onChange({ fgColor: "#1a1a2e", bgColor: "#ffffff", logoDataUrl: null });
    toast.success("QR style reset");
  };

  const tabs = [
    { id: "fg" as const, label: "Foreground", icon: Palette },
    { id: "bg" as const, label: "Background", icon: Palette },
    { id: "logo" as const, label: "Logo", icon: ImagePlus },
  ];

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-secondary/60 rounded-xl p-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
              activeTab === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={handleReset}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          title="Reset to default"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Color grid */}
      {(activeTab === "fg" || activeTab === "bg") && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {activeTab === "fg" ? "QR Color" : "Background Color"}
            </p>
            <div
              className="w-5 h-5 rounded-md border border-border shadow-sm"
              style={{ backgroundColor: activeTab === "fg" ? style.fgColor : style.bgColor }}
            />
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {PRESET_COLORS.map((color) => {
              const isActive = activeTab === "fg"
                ? style.fgColor === color
                : style.bgColor === color;
              return (
                <button
                  key={color}
                  onClick={() =>
                    onChange({
                      ...style,
                      [activeTab === "fg" ? "fgColor" : "bgColor"]: color,
                    })
                  }
                  className={`w-full aspect-square rounded-lg border-2 transition-all ${
                    isActive
                      ? "border-primary scale-110 shadow-md"
                      : "border-border/50 hover:border-primary/40 hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
          {/* Custom color input */}
          <div className="flex items-center gap-2 mt-2.5">
            <input
              type="color"
              value={activeTab === "fg" ? style.fgColor : style.bgColor}
              onChange={(e) =>
                onChange({
                  ...style,
                  [activeTab === "fg" ? "fgColor" : "bgColor"]: e.target.value,
                })
              }
              className="w-8 h-8 rounded-lg border border-border cursor-pointer"
            />
            <input
              type="text"
              value={activeTab === "fg" ? style.fgColor : style.bgColor}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                  onChange({
                    ...style,
                    [activeTab === "fg" ? "fgColor" : "bgColor"]: val,
                  });
                }
              }}
              className="input-field flex-1 text-xs font-mono"
              placeholder="#000000"
            />
          </div>
        </div>
      )}

      {/* Logo tab */}
      {activeTab === "logo" && (
        <div className="space-y-3">
          {style.logoDataUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40">
              <img
                src={style.logoDataUrl}
                alt="QR logo"
                className="w-12 h-12 rounded-xl object-contain border border-border bg-card"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Logo added</p>
                <p className="text-[11px] text-muted-foreground">Displayed in QR center</p>
              </div>
              <button
                onClick={() => onChange({ ...style, logoDataUrl: null })}
                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ImagePlus size={18} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Upload Logo</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  PNG or SVG, max 500KB
                </p>
              </div>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
          <p className="text-[10px] text-muted-foreground text-center">
            Logo appears in the center of your QR code. Use a square image for best results.
          </p>
        </div>
      )}
    </div>
  );
};

export default QrCustomizer;
