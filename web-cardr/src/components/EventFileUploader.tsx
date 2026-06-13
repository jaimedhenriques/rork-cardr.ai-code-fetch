import { useState, useRef } from "react";
import { Upload, FileText, Image, X, Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface EventFileUploaderProps {
  eventId: string;
}

const EventFileUploader = ({ eventId }: EventFileUploaderProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files = [] } = useQuery({
    queryKey: ["event_files", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_files")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(selectedFiles)) {
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        if (!isImage && !isPdf) {
          toast.error(`${file.name}: Only images and PDFs are supported`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: File too large (max 10MB)`);
          continue;
        }

        const ext = file.name.split(".").pop();
        const filePath = `${user.id}/${eventId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("event-passes")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from("event_files").insert({
          event_id: eventId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_type: isPdf ? "pdf" : "image",
          file_size: file.size,
        } as any);
        if (dbError) throw dbError;
      }

      queryClient.invalidateQueries({ queryKey: ["event_files", eventId] });
      toast.success("Files uploaded");
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Upload failed");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      await supabase.storage.from("event-passes").remove([filePath]);
      await supabase.from("event_files").delete().eq("id", fileId);
      queryClient.invalidateQueries({ queryKey: ["event_files", eventId] });
      toast.success("File removed");
    } catch {
      toast.error("Failed to remove file");
    }
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("event-passes").getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <FileText size={14} /> Event Passes ({files.length})
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <><Loader2 size={11} className="animate-spin" /> Uploading...</>
          ) : (
            <><Upload size={11} /> Upload</>
          )}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file: any) => (
            <div
              key={file.id}
              className="flex items-center gap-3 py-2 px-3 rounded-xl bg-secondary/50"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {file.file_type === "pdf" ? (
                  <FileText size={14} className="text-primary" />
                ) : (
                  <Image size={14} className="text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {file.file_name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(file.file_size / 1024).toFixed(0)} KB
                </p>
              </div>
              <a
                href={getPublicUrl(file.file_path)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-primary/10"
              >
                <Eye size={12} className="text-primary" />
              </a>
              <button
                onClick={() => handleDelete(file.id, file.file_path)}
                className="p-1.5 rounded-lg hover:bg-destructive/10"
              >
                <X size={12} className="text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border border-dashed border-border/60 rounded-xl p-6 text-center hover:border-primary/30 transition-colors"
        >
          <Upload size={20} className="mx-auto mb-1.5 text-muted-foreground opacity-40" />
          <p className="text-xs text-muted-foreground">
            Upload event passes, badges, or tickets
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            PDF or images • Max 10MB each
          </p>
        </button>
      )}
    </div>
  );
};

export default EventFileUploader;
