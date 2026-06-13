import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface CardEditFormProps {
  editing: boolean;
  form: any;
  onFormChange: (form: any) => void;
  onSave: () => void;
}

const FIELDS = ["name", "title", "company", "email", "phone", "website", "linkedin"] as const;

const FIELD_KEYS: Record<string, string> = {
  name: "field.fullName",
  title: "field.jobTitle",
  company: "field.company",
  email: "field.email",
  phone: "field.phone",
  website: "field.website",
  linkedin: "field.linkedin",
};

const CardEditForm = ({ editing, form, onFormChange, onSave }: CardEditFormProps) => {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {editing && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          className="card-elevated p-5 space-y-3"
        >
          <h3 className="section-label mb-2">{t("cardEdit.title")}</h3>
          {FIELDS.map((field) => (
            <div key={field}>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">{t(FIELD_KEYS[field])}</label>
              <input value={form[field] || ""} onChange={(e) => onFormChange({ ...form, [field]: e.target.value })} className="input-field" />
            </div>
          ))}
          <button onClick={onSave} className="w-full btn-primary mt-2 flex items-center justify-center gap-2">
            <Check size={15} /> {t("cardEdit.saveChanges")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CardEditForm;