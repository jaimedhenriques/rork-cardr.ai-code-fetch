import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Upload, UserPlus, Camera, Loader2, Image, Sparkles, Globe, Linkedin, MapPin } from "lucide-react";
import { useApp, type Contact } from "@/context/AppContext";

import { supabase } from "@/integrations/supabase/client";
import { enrichContactViaIcypeas } from "@/lib/icypeas";
import { toast } from "sonner";
import UpgradePrompt from "@/components/UpgradePrompt";
import LinkedInConnectModal from "@/components/LinkedInConnectModal";

type Tab = "manual" | "image";

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
}

const AddContactModal = ({ open, onClose }: AddContactModalProps) => {
  const { addContact, updateContact, folders, canAddContact, contacts, contactLimit, isGuest } = useApp();
  const [tab, setTab] = useState<Tab>("image");
  const [scanning, setScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<Partial<Contact> | null>(null);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [manualData, setManualData] = useState({ name: "", company: "", title: "", email: "", phone: "", notes: "" });
  const [savedContactForLinkedIn, setSavedContactForLinkedIn] = useState<Partial<Contact> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setScannedData(null);
    setCapturedImage(null);
    setScanning(false);
    setManualData({ name: "", company: "", title: "", email: "", phone: "", notes: "" });
    setSelectedFolder("");
    setSavedContactForLinkedIn(null);
    setTab("image");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processImage = async (imageSrc: string) => {
    setScanning(true);
    try {
      const imageBase64 = imageSrc.startsWith("data:") ? imageSrc : await toBase64(imageSrc);
      const { data, error } = await supabase.functions.invoke("scan-badge", {
        body: { imageBase64 },
      });
      if (error) throw new Error(error.message || "Scan failed");
      if (data?.error) throw new Error(data.error);

      const contact = data.contact;
      if (!contact?.name) {
        toast.error("No contact info detected. Try a clearer image or enter manually.");
        setScanning(false);
        setCapturedImage(null);
        return;
      }

      setScannedData({
        name: contact.name || "",
        company: contact.company || "",
        title: contact.title || "",
        email: contact.email || "",
        phone: contact.phone || "",
        linkedin: contact.linkedin || undefined,
        website: contact.website || undefined,
        location: contact.location || undefined,
        enriched: !!(contact.linkedin || contact.website || contact.location),
        enrichedAt: new Date().toISOString(),
      });
      toast.success("Contact info extracted!");
    } catch (err: unknown) {
      console.error("Scan error:", err);
      const message = err instanceof Error ? err.message : "Failed to extract contact info.";
      toast.error(message);
      setCapturedImage(null);
    } finally {
      setScanning(false);
    }
  };

  const toBase64 = async (src: string): Promise<string> => {
    const res = await fetch(src);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image too large (max 10MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCapturedImage(dataUrl);
      processImage(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const autoEnrich = useCallback(async (contactId: string, contact: Partial<Contact>) => {
    try {
      const data = await enrichContactViaIcypeas({ name: contact.name, company: contact.company, title: contact.title, email: contact.email, linkedin: contact.linkedin, website: contact.website });
      if (!data?.enriched) return;
      const updates: Partial<Contact> = { enriched: true, enrichedAt: new Date().toISOString() };
      if (data.enriched.linkedin) updates.linkedin = data.enriched.linkedin;
      if (data.enriched.website) updates.website = data.enriched.website;
      if (data.enriched.location) updates.location = data.enriched.location;
      if (data.enriched.industry) updates.industry = data.enriched.industry;
      if (data.enriched.companySize) updates.companySize = data.enriched.companySize;
      if (data.enriched.title && !contact.title) updates.title = data.enriched.title;
      if (data.enriched.email && !contact.email) updates.email = data.enriched.email;
      if (data.enriched.phone && !contact.phone) updates.phone = data.enriched.phone;
      if (data.enriched.mobilePhone) updates.mobilePhone = data.enriched.mobilePhone;
      if (data.enriched.workPhone) updates.workPhone = data.enriched.workPhone;
      updateContact(contactId, updates);
      toast.success(`${contact.name} enriched with verified data!`);
    } catch {
      // Silent fail — enrichment is best-effort
    }
  }, [updateContact]);

  const handleSaveScanned = () => {
    if (!scannedData?.name) return;
    if (!canAddContact) { setShowUpgrade(true); return; }
    const contactId = Date.now().toString();
    addContact({
      id: contactId,
      name: scannedData.name || "", company: scannedData.company || "",
      title: scannedData.title || "", email: scannedData.email || "",
      phone: scannedData.phone || "",
      linkedin: scannedData.linkedin, website: scannedData.website,
      location: scannedData.location, industry: scannedData.industry,
      companySize: scannedData.companySize, enriched: scannedData.enriched,
      enrichedAt: scannedData.enrichedAt, notes: scannedData.notes,
      folderId: selectedFolder || undefined,
      scannedAt: new Date().toISOString(),
    });
    toast.success(`${scannedData.name} saved!`);
    // Auto-enrich in the background if not already enriched
    if (!scannedData.enriched) {
      autoEnrich(contactId, scannedData);
    }
    // Show LinkedIn connection prompt
    setSavedContactForLinkedIn({
      name: scannedData.name,
      company: scannedData.company,
      title: scannedData.title,
      linkedin: scannedData.linkedin,
      notes: scannedData.notes,
      industry: scannedData.industry,
      location: scannedData.location,
    });
    onClose();
  };

  const handleManualSave = () => {
    if (!manualData.name.trim()) { toast.error("Name is required"); return; }
    if (!canAddContact) { setShowUpgrade(true); return; }
    addContact({
      id: Date.now().toString(),
      name: manualData.name.trim(), company: manualData.company.trim(),
      title: manualData.title.trim(), email: manualData.email.trim(),
      phone: manualData.phone.trim(), notes: manualData.notes.trim() || undefined,
      folderId: selectedFolder || undefined,
      scannedAt: new Date().toISOString(),
    });
    toast.success(`${manualData.name} saved!`);
    // Show LinkedIn connection prompt
    setSavedContactForLinkedIn({
      name: manualData.name.trim(),
      company: manualData.company.trim(),
      title: manualData.title.trim(),
      notes: manualData.notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={handleClose}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-display font-bold text-foreground">Add Contact</h2>
                <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Tabs */}
              {!scannedData && (
                <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-4">
                  {([
                    { id: "image" as Tab, icon: Image, label: "From Image" },
                    { id: "manual" as Tab, icon: UserPlus, label: "Manual Entry" },
                  ]).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                        tab === id
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Image Upload Tab */}
              {tab === "image" && !scannedData && (
                <div className="space-y-4">
                  {capturedImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-border aspect-[4/3]">
                      <img src={capturedImage} alt="Uploaded" className="w-full h-full object-cover" />
                      {scanning && (
                        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                          <Loader2 size={28} className="text-primary animate-spin" />
                          <p className="text-sm text-muted-foreground font-medium">Extracting contact info...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={scanning}
                      className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors flex flex-col items-center justify-center gap-3 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center">
                        <Upload size={22} className="text-primary" />
                      </div>
                      <div className="text-center px-6">
                          <p className="text-sm font-semibold text-foreground">Upload a screenshot or photo</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          LinkedIn profile, business card, badge — we'll extract the info
                        </p>
                      </div>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </div>
              )}

              {/* Manual Entry Tab */}
              {tab === "manual" && !scannedData && (
                <div className="space-y-3">
                  {(["name", "company", "title", "email", "phone"] as const).map((field) => (
                    <div key={field}>
                      <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">
                        {field}{field === "name" && " *"}
                      </label>
                      <input
                        value={manualData[field]}
                        onChange={(e) => setManualData({ ...manualData, [field]: e.target.value })}
                        placeholder={field === "name" ? "John Doe" : field === "email" ? "john@company.com" : field === "phone" ? "+1 555 0123" : ""}
                        className="input-field"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Notes</label>
                    <textarea
                      value={manualData.notes}
                      onChange={(e) => setManualData({ ...manualData, notes: e.target.value })}
                      placeholder="e.g. Met at the keynote, interested in partnership…"
                      rows={2} maxLength={500}
                      className="input-field resize-none"
                    />
                  </div>

                  {/* Folder */}
                  <div>
                    <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Assign to Event</label>
                    <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)} className="input-field">
                      <option value="">No event folder</option>
                      {folders.map((f) => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
                    </select>
                  </div>

                  <button
                    onClick={handleManualSave}
                    disabled={!manualData.name.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    <Check size={16} /> Save Contact
                  </button>
                </div>
              )}

              {/* Scanned Result (editable) */}
              {scannedData && (
                <div className="space-y-3">
                  {capturedImage && (
                    <div className="rounded-xl overflow-hidden border border-border h-24">
                      <img src={capturedImage} alt="Source" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full bg-success-light flex items-center justify-center">
                      <Check size={12} className="text-success" />
                    </div>
                    <span className="text-xs font-semibold text-success">Contact Extracted</span>
                  </div>

                  {(["name", "company", "title", "email", "phone"] as const).map((field) => (
                    <div key={field}>
                      <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">{field}</label>
                      <input
                        value={scannedData[field] || ""}
                        onChange={(e) => setScannedData({ ...scannedData, [field]: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Notes</label>
                    <textarea
                      value={scannedData.notes || ""}
                      onChange={(e) => setScannedData({ ...scannedData, notes: e.target.value })}
                      placeholder="Add a note…"
                      rows={2} maxLength={500}
                      className="input-field resize-none"
                    />
                  </div>

                  {/* Enriched details */}
                  {scannedData.enriched && (
                    <div className="p-3 rounded-xl bg-secondary/50 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={12} className="text-primary" />
                        <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Additional Details</span>
                      </div>
                      {scannedData.linkedin && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Linkedin size={12} className="text-primary" /> {scannedData.linkedin}
                        </div>
                      )}
                      {scannedData.website && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Globe size={12} className="text-primary" /> {scannedData.website}
                        </div>
                      )}
                      {scannedData.location && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin size={12} className="text-primary" /> {scannedData.location}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Folder */}
                  <div>
                    <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Assign to Event</label>
                    <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)} className="input-field">
                      <option value="">No event folder</option>
                      {folders.map((f) => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setScannedData(null); setCapturedImage(null); }} className="btn-secondary flex items-center justify-center gap-2 text-sm">
                      <X size={16} /> Try Again
                    </button>
                    <button onClick={handleSaveScanned} className="btn-primary flex items-center justify-center gap-2 text-sm">
                      <Check size={16} /> Save
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason={`You've reached ${contactLimit} contacts on the free plan. Create an account and upgrade to save unlimited contacts.`}
      />

      {savedContactForLinkedIn && (
        <LinkedInConnectModal
          contact={savedContactForLinkedIn}
          open={!!savedContactForLinkedIn}
          onClose={() => {
            setSavedContactForLinkedIn(null);
            reset();
          }}
          defaultType="connection_request"
        />
      )}
    </>
  );
};

export default AddContactModal;
