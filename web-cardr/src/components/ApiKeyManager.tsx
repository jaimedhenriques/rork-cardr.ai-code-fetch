import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Key, Copy, Trash2, Plus, Check, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase, SUPABASE_FUNCTIONS_URL } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

interface ApiKey {
  id: string;
  key_prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function ApiKeyManager() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const loadKeys = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_api_keys" as any)
      .select("id, key_prefix, label, created_at, last_used_at, revoked_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    setKeys((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const generateKey = async () => {
    if (!user) return;
    setGenerating(true);

    // Generate a random API key
    const rawBytes = new Uint8Array(32);
    crypto.getRandomValues(rawBytes);
    const apiKey = "csp_" + [...rawBytes].map(b => b.toString(16).padStart(2, "0")).join("");

    // Hash it
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
    const hashHex = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, "0")).join("");

    const keyPrefix = apiKey.slice(0, 12) + "...";

    const { error } = await supabase
      .from("user_api_keys" as any)
      .insert({
        user_id: user.id,
        key_hash: hashHex,
        key_prefix: keyPrefix,
        label: "MCP API Key",
      } as any);

    if (error) {
      toast.error("Failed to generate API key");
      setGenerating(false);
      return;
    }

    setNewKey(apiKey);
    setShowKey(true);
    toast.success("API key generated");
    loadKeys();
    setGenerating(false);
  };

  const revokeKey = async (id: string) => {
    const { error } = await supabase
      .from("user_api_keys" as any)
      .update({ revoked_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (error) {
      toast.error("Failed to revoke key");
      return;
    }
    toast.success("API key revoked");
    loadKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const mcpUrl = `${SUPABASE_FUNCTIONS_URL}/mcp-server`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* MCP Endpoint */}
      <div className="card-elevated p-4">
        <div className="flex items-center gap-2 mb-2">
          <ExternalLink size={14} className="text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">MCP Server URL</h3>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-secondary/60 rounded-lg px-3 py-2 text-foreground break-all font-mono">
            {mcpUrl}
          </code>
          <button
            onClick={() => copyToClipboard(mcpUrl)}
            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 hover:bg-secondary/80 transition-colors"
          >
            <Copy size={13} className="text-muted-foreground" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Use this URL in Claude Desktop, Cursor, or any MCP-compatible client.
        </p>
      </div>

      {/* New key reveal */}
      {newKey && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card-elevated p-4 border-primary/30 border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Key size={14} className="text-primary" />
            <h3 className="text-xs font-bold text-primary">New API Key — Copy Now</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            This key will only be shown once. Save it somewhere safe.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-secondary/60 rounded-lg px-3 py-2 font-mono break-all text-foreground">
              {showKey ? newKey : "•".repeat(40)}
            </code>
            <button
              onClick={() => setShowKey(!showKey)}
              className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0"
            >
              {showKey ? <EyeOff size={13} className="text-muted-foreground" /> : <Eye size={13} className="text-muted-foreground" />}
            </button>
            <button
              onClick={() => copyToClipboard(newKey)}
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0"
            >
              <Copy size={13} className="text-primary-foreground" />
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-[10px] text-muted-foreground mt-2 underline"
          >
            I've saved it — dismiss
          </button>
        </motion.div>
      )}

      {/* Key list + generate */}
      <div className="card-elevated p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key size={14} className="text-muted-foreground" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">API Keys</h3>
          </div>
          <button
            onClick={generateKey}
            disabled={generating || keys.length >= 5}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-40"
          >
            <Plus size={13} /> Generate
          </button>
        </div>

        {loading && <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>}

        {!loading && keys.length === 0 && (
          <p className="text-xs text-muted-foreground/60 text-center py-4">
            No API keys yet. Generate one to connect MCP clients.
          </p>
        )}

        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center gap-3 bg-secondary/60 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{key.label}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{key.key_prefix}</p>
                {key.last_used_at && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Last used: {new Date(key.last_used_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => revokeKey(key.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={13} className="text-destructive" />
              </button>
            </div>
          ))}
        </div>

        {keys.length >= 5 && (
          <p className="text-[10px] text-amber-400 mt-2">Max 5 active keys. Revoke one to generate another.</p>
        )}
      </div>

      {/* Usage guide */}
      <div className="card-elevated p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Quick Setup</h3>
        <div className="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
          <p>1. Generate an API key above</p>
          <p>2. Add to your MCP client config:</p>
          <code className="block bg-secondary/60 rounded-lg p-3 text-[10px] font-mono text-foreground whitespace-pre overflow-x-auto">
{`{
  "mcpServers": {
    "cardscanpro": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}
          </code>
          <p className="mt-2">Available tools: list_contacts, get_contact, list_notes, get_note, list_events, list_pipeline_stages, list_calendar_events, list_tags, list_folders</p>
        </div>
      </div>
    </motion.div>
  );
}
