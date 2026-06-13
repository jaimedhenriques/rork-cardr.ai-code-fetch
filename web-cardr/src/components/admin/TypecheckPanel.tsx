/**
 * TypecheckPanel
 * --------------
 * Platform-admin-only panel that summarizes the latest `deno check` run on
 * `supabase/functions/*`. A row is inserted into `public.typecheck_runs` by CI
 * after every type-check run; the panel subscribes to Postgres changes on that
 * table so it updates the moment a new run lands — no polling, no page reload.
 *
 * The panel surfaces, at a glance:
 *   - the latest run's outcome (✓ / ✗) + commit + branch + age
 *   - per-file error groups, with each error's TS code (e.g. `TS2304`) and the
 *     failing line/column so an operator can jump straight to the fix
 *   - a sparkline-style history of the last 10 runs so trend regressions are
 *     visible without leaving the page
 *   - filters (search, file, severity, error code) to quickly narrow down
 *     specific issues in large error sets
 *
 * CI contract (documented here so the producer and consumer stay in sync):
 *   INSERT INTO typecheck_runs (commit_sha, branch, succeeded, error_count,
 *     errors, duration_ms)
 *   VALUES (..., ..., ..., ..., $1::jsonb, ...)
 *   where $1 is a JSON array of:
 *     { file: string, code: string, line: number, column: number, message: string }
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, FileWarning, GitBranch, RefreshCw, Loader2,
  ChevronDown, ChevronRight, Radio, Download, ExternalLink, Settings2,
  Search, Filter, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  type EditorPrefs,
  type EditorKind,
  loadEditorPrefs,
  saveEditorPrefs,
  buildEditorUrl,
} from "@/lib/editorDeepLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface TypecheckError {
  file: string;
  code: string;
  line: number;
  column: number;
  message: string;
}

interface TypecheckRun {
  id: string;
  commit_sha: string | null;
  branch: string | null;
  succeeded: boolean;
  error_count: number;
  errors: TypecheckError[];
  duration_ms: number | null;
  created_at: string;
}

/** Severity derived from TS error code families. */
type Severity = "Critical" | "High" | "Medium" | "Low";

const SEVERITY_ORDER: Severity[] = ["Critical", "High", "Medium", "Low"];

const CRITICAL_CODES = new Set([
  "TS2304", "TS2307", "TS2305", "TS2554", "TS2555", "TS2341", "TS2328",
  "TS2350", "TS2448", "TS2454", "TS2552", "TS2588", "TS2580", "TS2593",
]);
const HIGH_CODES = new Set([
  "TS2322", "TS2345", "TS2769", "TS2741", "TS2740", "TS2739", "TS2732",
  "TS2724", "TS2719", "TS2783", "TS2786", "TS2344", "TS2348", "TS2352",
  "TS2353", "TS2355", "TS2360", "TS2361", "TS2362", "TS2364", "TS2365",
  "TS2366", "TS2367", "TS2370", "TS2371", "TS2372", "TS2373", "TS2374",
  "TS2375", "TS2377", "TS2393", "TS2394", "TS2395", "TS2412", "TS2415",
  "TS2425", "TS2428", "TS2430", "TS2431", "TS2432", "TS2433", "TS2440",
  "TS2445", "TS2451", "TS2459", "TS2461", "TS2462", "TS2463", "TS2464",
  "TS2469", "TS2471", "TS2472", "TS2473", "TS2474", "TS2475", "TS2476",
  "TS2484", "TS2493", "TS2497", "TS2498", "TS2501", "TS2502", "TS2503",
  "TS2506", "TS2507", "TS2508", "TS2510", "TS2511", "TS2512", "TS2514",
  "TS2515", "TS2525", "TS2526", "TS2528", "TS2529", "TS2530", "TS2531",
  "TS2532", "TS2533", "TS2534", "TS2535", "TS2536", "TS2538", "TS2540",
  "TS2541", "TS2542", "TS2543", "TS2545", "TS2546", "TS2547", "TS2549",
  "TS2550", "TS2551", "TS2556", "TS2557", "TS2558", "TS2559", "TS2561",
  "TS2564", "TS2565", "TS2567", "TS2570", "TS2571", "TS2572", "TS2573",
  "TS2574", "TS2575", "TS2576", "TS2577", "TS2581", "TS2582", "TS2583",
  "TS2584", "TS2585", "TS2586", "TS2589", "TS2590", "TS2591", "TS2592",
  "TS2594", "TS2595", "TS2596", "TS2597", "TS2598", "TS2601", "TS2602",
  "TS2603", "TS2604", "TS2605", "TS2606", "TS2607", "TS2608", "TS2610",
  "TS2611", "TS2612", "TS2613", "TS2614", "TS2615", "TS2616", "TS2617",
  "TS2618", "TS2619", "TS2620", "TS2621", "TS2622", "TS2623", "TS2624",
  "TS2625", "TS2626", "TS2627", "TS2628", "TS2629", "TS2630", "TS2631",
  "TS2632", "TS2633", "TS2634", "TS2635", "TS2636", "TS2637", "TS2638",
  "TS2639", "TS2640", "TS2641", "TS2642", "TS2643", "TS2644", "TS2645",
  "TS2646", "TS2647", "TS2648", "TS2649", "TS2650", "TS2651", "TS2652",
  "TS2653", "TS2654", "TS2655", "TS2656", "TS2657", "TS2658", "TS2659",
  "TS2660", "TS2661", "TS2662", "TS2663", "TS2664", "TS2665", "TS2666",
  "TS2667", "TS2668", "TS2669", "TS2670", "TS2671", "TS2672", "TS2673",
  "TS2674", "TS2675", "TS2676", "TS2677", "TS2678", "TS2679", "TS2680",
  "TS2681", "TS2682", "TS2683", "TS2684", "TS2685", "TS2686", "TS2687",
  "TS2688", "TS2689", "TS2690", "TS2691", "TS2692", "TS2693", "TS2694",
  "TS2695", "TS2696", "TS2697", "TS2698", "TS2699", "TS2700", "TS2701",
  "TS2702", "TS2703", "TS2704", "TS2705", "TS2706", "TS2707", "TS2708",
  "TS2709", "TS2710", "TS2711", "TS2712", "TS2713", "TS2714", "TS2715",
  "TS2716", "TS2717", "TS2718", "TS2720", "TS2721", "TS2722", "TS2723",
  "TS2725", "TS2726", "TS2727", "TS2728", "TS2729", "TS2730", "TS2731",
  "TS2733", "TS2734", "TS2735", "TS2736", "TS2737", "TS2738", "TS2740",
  "TS2742", "TS2743", "TS2744", "TS2745", "TS2746", "TS2747", "TS2748",
  "TS2749", "TS2750", "TS2751", "TS2752", "TS2753", "TS2754", "TS2755",
  "TS2756", "TS2757", "TS2758", "TS2759", "TS2760", "TS2761", "TS2762",
  "TS2763", "TS2764", "TS2765", "TS2766", "TS2767", "TS2768", "TS2770",
  "TS2771", "TS2772", "TS2773", "TS2774", "TS2775", "TS2776", "TS2777",
  "TS2778", "TS2779", "TS2780", "TS2781", "TS2782", "TS2784", "TS2785",
  "TS2786", "TS2787", "TS2788", "TS2789", "TS2790", "TS2791", "TS2792",
  "TS2793", "TS2794", "TS2795", "TS2796", "TS2797", "TS2798", "TS2799",
]);
const MEDIUM_CODES = new Set([
  "TS7006", "TS7008", "TS7009", "TS7010", "TS7011", "TS7012", "TS7013",
  "TS7014", "TS7015", "TS7016", "TS7017", "TS7018", "TS7019", "TS7020",
  "TS7022", "TS7023", "TS7024", "TS7025", "TS7026", "TS7027", "TS7029",
  "TS7030", "TS7031", "TS7032", "TS7033", "TS7034", "TS7035", "TS7036",
  "TS7037", "TS7038", "TS7039", "TS7040", "TS7041", "TS7042", "TS7043",
  "TS7044", "TS7045", "TS7046", "TS7047", "TS7048", "TS7049", "TS7050",
  "TS7051", "TS7052", "TS7053", "TS7054", "TS7055", "TS7056", "TS7057",
  "TS7058", "TS7059", "TS7060", "TS7061", "TS7062", "TS7063", "TS7064",
  "TS7065", "TS7066", "TS7067", "TS7068", "TS7069", "TS7070", "TS7071",
  "TS7072", "TS7073", "TS7074", "TS7075", "TS7076", "TS7077", "TS7078",
  "TS7079", "TS7080", "TS7081", "TS7082", "TS7083", "TS7084", "TS7085",
  "TS7086", "TS7087", "TS7088", "TS7089", "TS7090", "TS7091", "TS7092",
  "TS7093", "TS7094", "TS7095", "TS7096", "TS7097", "TS7098", "TS7099",
  "TS7100", "TS7101", "TS7102", "TS7103", "TS7104", "TS7105", "TS7106",
  "TS7107", "TS7108", "TS7109", "TS7110", "TS7111", "TS7112", "TS7113",
  "TS7114", "TS7115", "TS7116", "TS7117", "TS7118", "TS7119", "TS7120",
  "TS7121", "TS7122", "TS7123", "TS7124", "TS7125", "TS7126", "TS7127",
  "TS7128", "TS7129", "TS7130", "TS7131", "TS7132", "TS7133", "TS7134",
  "TS7135", "TS7136", "TS7137", "TS7138", "TS7139", "TS7140", "TS7141",
  "TS7142", "TS7143", "TS7144", "TS7145", "TS7146", "TS7147", "TS7148",
  "TS7149", "TS7150", "TS7151", "TS7152", "TS7153", "TS7154", "TS7155",
  "TS7156", "TS7157", "TS7158", "TS7159", "TS7160", "TS7161", "TS7162",
  "TS7163", "TS7164", "TS7165", "TS7166", "TS7167", "TS7168", "TS7169",
  "TS7170", "TS7171", "TS7172", "TS7173", "TS7174", "TS7175", "TS7176",
  "TS7177", "TS7178", "TS7179", "TS7180", "TS7181", "TS7182", "TS7183",
  "TS7184", "TS7185", "TS7186", "TS7187", "TS7188", "TS7189", "TS7190",
  "TS7191", "TS7192", "TS7193", "TS7194", "TS7195", "TS7196", "TS7197",
  "TS7198", "TS7199", "TS7200", "TS7201", "TS7202", "TS7203", "TS7204",
  "TS7205", "TS7206", "TS7207", "TS7208", "TS7209", "TS7210", "TS7211",
  "TS7212", "TS7213", "TS7214", "TS7215", "TS7216", "TS7217", "TS7218",
  "TS7219", "TS7220", "TS7221", "TS7222", "TS7223", "TS7224", "TS7225",
  "TS7226", "TS7227", "TS7228", "TS7229", "TS7230", "TS7231", "TS7232",
  "TS7233", "TS7234", "TS7235", "TS7236", "TS7237", "TS7238", "TS7239",
  "TS7240", "TS7241", "TS7242", "TS7243", "TS7244", "TS7245", "TS7246",
  "TS7247", "TS7248", "TS7249", "TS7250", "TS7251", "TS7252", "TS7253",
  "TS7254", "TS7255", "TS7256", "TS7257", "TS7258", "TS7259", "TS7260",
  "TS7261", "TS7262", "TS7263", "TS7264", "TS7265", "TS7266", "TS7267",
  "TS7268", "TS7269", "TS7270", "TS7271", "TS7272", "TS7273", "TS7274",
  "TS7275", "TS7276", "TS7277", "TS7278", "TS7279", "TS7280", "TS7281",
  "TS7282", "TS7283", "TS7284", "TS7285", "TS7286", "TS7287", "TS7288",
  "TS7289", "TS7290", "TS7291", "TS7292", "TS7293", "TS7294", "TS7295",
  "TS7296", "TS7297", "TS7298", "TS7299", "TS7300", "TS7301", "TS7302",
  "TS7303", "TS7304", "TS7305", "TS7306", "TS7307", "TS7308", "TS7309",
  "TS7310", "TS7311", "TS7312", "TS7313", "TS7314", "TS7315", "TS7316",
  "TS7317", "TS7318", "TS7319", "TS7320", "TS7321", "TS7322", "TS7323",
  "TS7324", "TS7325", "TS7326", "TS7327", "TS7328", "TS7329", "TS7330",
  "TS7331", "TS7332", "TS7333", "TS7334", "TS7335", "TS7336", "TS7337",
  "TS7338", "TS7339", "TS7340", "TS7341", "TS7342", "TS7343", "TS7344",
  "TS7345", "TS7346", "TS7347", "TS7348", "TS7349", "TS7350", "TS7351",
  "TS7352", "TS7353", "TS7354", "TS7355", "TS7356", "TS7357", "TS7358",
  "TS7359", "TS7360", "TS7361", "TS7362", "TS7363", "TS7364", "TS7365",
  "TS7366", "TS7367", "TS7368", "TS7369", "TS7370", "TS7371", "TS7372",
  "TS7373", "TS7374", "TS7375", "TS7376", "TS7377", "TS7378", "TS7379",
  "TS7380", "TS7381", "TS7382", "TS7383", "TS7384", "TS7385", "TS7386",
  "TS7387", "TS7388", "TS7389", "TS7390", "TS7391", "TS7392", "TS7393",
  "TS7394", "TS7395", "TS7396", "TS7397", "TS7398", "TS7399", "TS7400",
  "TS7401", "TS7402", "TS7403", "TS7404", "TS7405", "TS7406", "TS7407",
  "TS7408", "TS7409", "TS7410", "TS7411", "TS7412", "TS7413", "TS7414",
  "TS7415", "TS7416", "TS7417", "TS7418", "TS7419", "TS7420", "TS7421",
  "TS7422", "TS7423", "TS7424", "TS7425", "TS7426", "TS7427", "TS7428",
  "TS7429", "TS7430", "TS7431", "TS7432", "TS7433", "TS7434", "TS7435",
  "TS7436", "TS7437", "TS7438", "TS7439", "TS7440", "TS7441", "TS7442",
  "TS7443", "TS7444", "TS7445", "TS7446", "TS7447", "TS7448", "TS7449",
  "TS7450", "TS7451", "TS7452", "TS7453", "TS7454", "TS7455", "TS7456",
  "TS7457", "TS7458", "TS7459", "TS7460", "TS7461", "TS7462", "TS7463",
  "TS7464", "TS7465", "TS7466", "TS7467", "TS7468", "TS7469", "TS7470",
  "TS7471", "TS7472", "TS7473", "TS7474", "TS7475", "TS7476", "TS7477",
  "TS7478", "TS7479", "TS7480", "TS7481", "TS7482", "TS7483", "TS7484",
  "TS7485", "TS7486", "TS7487", "TS7488", "TS7489", "TS7490", "TS7491",
  "TS7492", "TS7493", "TS7494", "TS7495", "TS7496", "TS7497", "TS7498",
  "TS7499", "TS7500", "TS7501", "TS7502", "TS7503", "TS7504", "TS7505",
  "TS7506", "TS7507", "TS7508", "TS7509", "TS7510", "TS7511", "TS7512",
  "TS7513", "TS7514", "TS7515", "TS7516", "TS7517", "TS7518", "TS7519",
  "TS7520", "TS7521", "TS7522", "TS7523", "TS7524", "TS7525", "TS7526",
  "TS7527", "TS7528", "TS7529", "TS7530", "TS7531", "TS7532", "TS7533",
  "TS7534", "TS7535", "TS7536", "TS7537", "TS7538", "TS7539", "TS7540",
  "TS7541", "TS7542", "TS7543", "TS7544", "TS7545", "TS7546", "TS7547",
  "TS7548", "TS7549", "TS7550", "TS7551", "TS7552", "TS7553", "TS7554",
  "TS7555", "TS7556", "TS7557", "TS7558", "TS7559", "TS7560", "TS7561",
  "TS7562", "TS7563", "TS7564", "TS7565", "TS7566", "TS7567", "TS7568",
  "TS7569", "TS7570", "TS7571", "TS7572", "TS7573", "TS7574", "TS7575",
  "TS7576", "TS7577", "TS7578", "TS7579", "TS7580", "TS7581", "TS7582",
  "TS7583", "TS7584", "TS7585", "TS7586", "TS7587", "TS7588", "TS7589",
  "TS7590", "TS7591", "TS7592", "TS7593", "TS7594", "TS7595", "TS7596",
  "TS7597", "TS7598", "TS7599", "TS7600", "TS7601", "TS7602", "TS7603",
  "TS7604", "TS7605", "TS7606", "TS7607", "TS7608", "TS7609", "TS7610",
  "TS7611", "TS7612", "TS7613", "TS7614", "TS7615", "TS7616", "TS7617",
  "TS7618", "TS7619", "TS7620", "TS7621", "TS7622", "TS7623", "TS7624",
  "TS7625", "TS7626", "TS7627", "TS7628", "TS7629", "TS7630", "TS7631",
  "TS7632", "TS7633", "TS7634", "TS7635", "TS7636", "TS7637", "TS7638",
  "TS7639", "TS7640", "TS7641", "TS7642", "TS7643", "TS7644", "TS7645",
  "TS7646", "TS7647", "TS7648", "TS7649", "TS7650", "TS7651", "TS7652",
  "TS7653", "TS7654", "TS7655", "TS7656", "TS7657", "TS7658", "TS7659",
  "TS7660", "TS7661", "TS7662", "TS7663", "TS7664", "TS7665", "TS7666",
  "TS7667", "TS7668", "TS7669", "TS7670", "TS7671", "TS7672", "TS7673",
  "TS7674", "TS7675", "TS7676", "TS7677", "TS7678", "TS7679", "TS7680",
  "TS7681", "TS7682", "TS7683", "TS7684", "TS7685", "TS7686", "TS7687",
  "TS7688", "TS7689", "TS7690", "TS7691", "TS7692", "TS7693", "TS7694",
  "TS7695", "TS7696", "TS7697", "TS7698", "TS7699", "TS7700", "TS7701",
  "TS7702", "TS7703", "TS7704", "TS7705", "TS7706", "TS7707", "TS7708",
  "TS7709", "TS7710", "TS7711", "TS7712", "TS7713", "TS7714", "TS7715",
  "TS7716", "TS7717", "TS7718", "TS7719", "TS7720", "TS7721", "TS7722",
  "TS7723", "TS7724", "TS7725", "TS7726", "TS7727", "TS7728", "TS7729",
  "TS7730", "TS7731", "TS7732", "TS7733", "TS7734", "TS7735", "TS7736",
  "TS7737", "TS7738", "TS7739", "TS7740", "TS7741", "TS7742", "TS7743",
  "TS7744", "TS7745", "TS7746", "TS7747", "TS7748", "TS7749", "TS7750",
  "TS7751", "TS7752", "TS7753", "TS7754", "TS7755", "TS7756", "TS7757",
  "TS7758", "TS7759", "TS7760", "TS7761", "TS7762", "TS7763", "TS7764",
  "TS7765", "TS7766", "TS7767", "TS7768", "TS7769", "TS7770", "TS7771",
  "TS7772", "TS7773", "TS7774", "TS7775", "TS7776", "TS7777", "TS7778",
  "TS7779", "TS7780", "TS7781", "TS7782", "TS7783", "TS7784", "TS7785",
  "TS7786", "TS7787", "TS7788", "TS7789", "TS7790", "TS7791", "TS7792",
  "TS7793", "TS7794", "TS7795", "TS7796", "TS7797", "TS7798", "TS7799",
  "TS7800", "TS7801", "TS7802", "TS7803", "TS7804", "TS7805", "TS7806",
  "TS7807", "TS7808", "TS7809", "TS7810", "TS7811", "TS7812", "TS7813",
  "TS7814", "TS7815", "TS7816", "TS7817", "TS7818", "TS7819", "TS7820",
  "TS7821", "TS7822", "TS7823", "TS7824", "TS7825", "TS7826", "TS7827",
  "TS7828", "TS7829", "TS7830", "TS7831", "TS7832", "TS7833", "TS7834",
  "TS7835", "TS7836", "TS7837", "TS7838", "TS7839", "TS7840", "TS7841",
  "TS7842", "TS7843", "TS7844", "TS7845", "TS7846", "TS7847", "TS7848",
  "TS7849", "TS7850", "TS7851", "TS7852", "TS7853", "TS7854", "TS7855",
  "TS7856", "TS7857", "TS7858", "TS7859", "TS7860", "TS7861", "TS7862",
  "TS7863", "TS7864", "TS7865", "TS7866", "TS7867", "TS7868", "TS7869",
  "TS7870", "TS7871", "TS7872", "TS7873", "TS7874", "TS7875", "TS7876",
  "TS7877", "TS7878", "TS7879", "TS7880", "TS7881", "TS7882", "TS7883",
  "TS7884", "TS7885", "TS7886", "TS7887", "TS7888", "TS7889", "TS7890",
  "TS7891", "TS7892", "TS7893", "TS7894", "TS7895", "TS7896", "TS7897",
  "TS7898", "TS7899", "TS7900", "TS7901", "TS7902", "TS7903", "TS7904",
  "TS7905", "TS7906", "TS7907", "TS7908", "TS7909", "TS7910", "TS7911",
  "TS7912", "TS7913", "TS7914", "TS7915", "TS7916", "TS7917", "TS7918",
  "TS7919", "TS7920", "TS7921", "TS7922", "TS7923", "TS7924", "TS7925",
  "TS7926", "TS7927", "TS7928", "TS7929", "TS7930", "TS7931", "TS7932",
  "TS7933", "TS7934", "TS7935", "TS7936", "TS7937", "TS7938", "TS7939",
  "TS7940", "TS7941", "TS7942", "TS7943", "TS7944", "TS7945", "TS7946",
  "TS7947", "TS7948", "TS7949", "TS7950", "TS7951", "TS7952", "TS7953",
  "TS7954", "TS7955", "TS7956", "TS7957", "TS7958", "TS7959", "TS7960",
  "TS7961", "TS7962", "TS7963", "TS7964", "TS7965", "TS7966", "TS7967",
  "TS7968", "TS7969", "TS7970", "TS7971", "TS7972", "TS7973", "TS7974",
  "TS7975", "TS7976", "TS7977", "TS7978", "TS7979", "TS7980", "TS7981",
  "TS7982", "TS7983", "TS7984", "TS7985", "TS7986", "TS7987", "TS7988",
  "TS7989", "TS7990", "TS7991", "TS7992", "TS7993", "TS7994", "TS7995",
  "TS7996", "TS7997", "TS7998", "TS7999",
]);

function severityOf(code: string): Severity {
  if (CRITICAL_CODES.has(code)) return "Critical";
  if (HIGH_CODES.has(code)) return "High";
  if (MEDIUM_CODES.has(code)) return "Medium";
  return "Low";
}

function severityColor(sev: Severity): string {
  switch (sev) {
    case "Critical": return "bg-red-500/20 text-red-400 border-red-400/30";
    case "High": return "bg-orange-500/20 text-orange-400 border-orange-400/30";
    case "Medium": return "bg-amber-500/20 text-amber-400 border-amber-400/30";
    case "Low": return "bg-blue-500/20 text-blue-400 border-blue-400/30";
  }
}

const HISTORY_LIMIT = 10;


/**
 * Normalize a raw row from `typecheck_runs` (where `errors` is `Json`) into
 * the strongly-typed shape the panel renders. We defensively coerce because
 * the JSONB column is, by definition, untyped from the database's perspective
 * — a malformed CI payload should degrade gracefully (empty error list)
 * rather than crash the entire panel.
 */
function normalizeRun(row: any): TypecheckRun {
  const rawErrors = Array.isArray(row?.errors) ? row.errors : [];
  const errors: TypecheckError[] = rawErrors.map((e: any) => ({
    file: String(e?.file ?? "unknown"),
    code: String(e?.code ?? "TS?"),
    line: Number(e?.line ?? 0),
    column: Number(e?.column ?? 0),
    message: String(e?.message ?? ""),
  }));
  return {
    id: String(row.id),
    commit_sha: row.commit_sha ?? null,
    branch: row.branch ?? null,
    succeeded: !!row.succeeded,
    error_count: Number(row.error_count ?? errors.length),
    errors,
    duration_ms: row.duration_ms ?? null,
    created_at: row.created_at,
  };
}

const TypecheckPanel = () => {
  const [runs, setRuns] = useState<TypecheckRun[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracks the most recent realtime delivery so operators can confirm the
  // subscription is live (small "live" pulse next to the header).
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [prefs, setPrefs] = useState<EditorPrefs>(loadEditorPrefs);

  // ── Filter state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFile, setFilterFile] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "">("");
  const [filterCode, setFilterCode] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Persist editor prefs whenever they change. localStorage is fine here —
  // it's per-operator UI state, not user data.
  useEffect(() => {
    saveEditorPrefs(prefs);
  }, [prefs]);

  // ── Initial fetch ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("typecheck_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (cancelled) return;
      if (!error && data) {
        const normalized = data.map(normalizeRun);
        setRuns(normalized);
        // Auto-expand every failing file in the latest run so the operator
        // doesn't have to click through to see what's broken on first load.
        const latest = normalized[0];
        if (latest && !latest.succeeded) {
          setExpandedFiles(new Set(latest.errors.map((e) => e.file)));
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Realtime subscription ──
  // Postgres-changes is push-based: the panel reflects new CI runs within ~1s
  // of the INSERT, with zero polling cost. We re-subscribe automatically if
  // the channel drops (Supabase client handles reconnect under the hood).
  useEffect(() => {
    const channel = supabase
      .channel("typecheck_runs:dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "typecheck_runs" },
        (payload) => {
          const incoming = normalizeRun(payload.new);
          setLastEventAt(new Date());
          setRuns((prev) => {
            // Guard against duplicate deliveries (e.g. brief reconnects can
            // replay a row). Keep the list capped at HISTORY_LIMIT.
            if (prev.some((r) => r.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, HISTORY_LIMIT);
          });
          // Auto-expand failing files for the *new* latest run so the panel's
          // "at a glance" promise holds without a manual click.
          if (!incoming.succeeded) {
            setExpandedFiles(new Set(incoming.errors.map((e) => e.file)));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const latest = runs[0];

  // ── Filtered + grouped errors ──
  const { groupedErrors, allFiles, allCodes, allSeverities, activeFilterCount } = useMemo(() => {
    if (!latest) return { groupedErrors: [] as { file: string; errors: TypecheckError[] }[], allFiles: [] as string[], allCodes: [] as string[], allSeverities: [] as Severity[], activeFilterCount: 0 };

    const q = searchQuery.trim().toLowerCase();
    const filtered = latest.errors.filter((err) => {
      if (q) {
        const hay = `${err.file} ${err.code} ${err.message}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterFile && err.file !== filterFile) return false;
      if (filterCode && err.code !== filterCode) return false;
      if (filterSeverity && severityOf(err.code) !== filterSeverity) return false;
      return true;
    });

    // Build unique options from the *unfiltered* set so operators can still
    // select values that are hidden by other active filters.
    const fileSet = new Set(latest.errors.map((e) => e.file));
    const codeSet = new Set(latest.errors.map((e) => e.code));
    const sevSet = new Set<Severity>(latest.errors.map((e) => severityOf(e.code)));
    const map = new Map<string, TypecheckError[]>();
    for (const err of filtered) {
      if (!map.has(err.file)) map.set(err.file, []);
      map.get(err.file)!.push(err);
    }
    const grouped = Array.from(map.entries())
      .map(([file, errors]) => ({
        file,
        errors: errors.sort((a, b) => a.line - b.line || a.column - b.column),
      }))
      .sort((a, b) => b.errors.length - a.errors.length);

    const activeCount = (searchQuery ? 1 : 0) + (filterFile ? 1 : 0) + (filterCode ? 1 : 0) + (filterSeverity ? 1 : 0);

    return {
      groupedErrors: grouped,
      allFiles: Array.from(fileSet).sort(),
      allCodes: Array.from(codeSet).sort(),
      allSeverities: SEVERITY_ORDER.filter((s) => sevSet.has(s)),
      activeFilterCount: activeCount,
    };
  }, [latest, searchQuery, filterFile, filterCode, filterSeverity]);

  // ── Aggregate analytics across the last N runs ──
  // Counts each error occurrence across every run currently loaded (capped at
  // HISTORY_LIMIT). Surfaces the noisiest files and most frequent TS codes so
  // operators can spot systemic issues vs one-off regressions.
  const analytics = useMemo(() => {
    const fileCounts = new Map<string, number>();
    const codeCounts = new Map<string, number>();
    let totalErrors = 0;
    let failingRuns = 0;
    for (const r of runs) {
      if (!r.succeeded) failingRuns++;
      for (const e of r.errors) {
        totalErrors++;
        fileCounts.set(e.file, (fileCounts.get(e.file) ?? 0) + 1);
        codeCounts.set(e.code, (codeCounts.get(e.code) ?? 0) + 1);
      }
    }
    const topFiles = Array.from(fileCounts.entries())
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const topCodes = Array.from(codeCounts.entries())
      .map(([code, count]) => ({ code, count, severity: severityOf(code) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const maxFile = topFiles[0]?.count ?? 0;
    const maxCode = topCodes[0]?.count ?? 0;
    const avgPerRun = runs.length > 0 ? totalErrors / runs.length : 0;
    return {
      runCount: runs.length,
      failingRuns,
      totalErrors,
      avgPerRun,
      uniqueFiles: fileCounts.size,
      uniqueCodes: codeCounts.size,
      topFiles,
      topCodes,
      maxFile,
      maxCode,
    };
  }, [runs]);

  const clearFilters = () => {
    setSearchQuery("");
    setFilterFile("");
    setFilterSeverity("");
    setFilterCode("");
  };

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("typecheck_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    if (data) setRuns(data.map(normalizeRun));
    setLoading(false);
  };

  // RFC 4180-ish CSV escape: wrap in quotes and double any embedded quotes.
  // Always quote so newlines/commas in TS error messages can't break the row.
  const csvCell = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  // Build a CSV of the latest run's errors so the operator can paste it into
  // an issue, share with another dev, or diff against a previous run after a
  // fix attempt. Filename includes the commit + timestamp for re-test trails.
  const exportCsv = () => {
    if (!latest || latest.errors.length === 0) return;
    const header = ["file", "line", "column", "code", "message"];
    const rows = latest.errors.map((e) =>
      [e.file, e.line, e.column, e.code, e.message].map(csvCell).join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const ts = new Date(latest.created_at).toISOString().replace(/[:.]/g, "-");
    const sha = latest.commit_sha?.slice(0, 7) ?? "local";
    const a = document.createElement("a");
    a.href = url;
    a.download = `typecheck-errors_${sha}_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ── Render ──
  if (loading && runs.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <Loader2 size={14} className="animate-spin" />
        Loading type-check history…
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <FileWarning size={28} className="mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">No type-check runs recorded yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          CI will publish a run after the next push to <code className="font-mono">main</code>.
        </p>
      </div>
    );
  }

  const liveDotFresh = lastEventAt && Date.now() - lastEventAt.getTime() < 4000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* ── Header / latest summary ── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            {latest.succeeded ? (
              <CheckCircle2 size={20} className="text-emerald-400" />
            ) : (
              <XCircle size={20} className="text-destructive" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {latest.succeeded
                  ? "Type-check passing"
                  : `${latest.error_count} type error${latest.error_count === 1 ? "" : "s"}`}
              </h3>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Clock size={10} />
                {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}
                {latest.duration_ms != null && (
                  <span className="opacity-70">· {(latest.duration_ms / 1000).toFixed(1)}s</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Live indicator: green pulse confirms the realtime channel is
                receiving events. Helpful for triaging "why didn't my run
                show up?" — if the dot never lights green after a CI run,
                the subscription is the problem, not the producer. */}
            <div
              className={cn(
                "flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                liveDotFresh
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-400"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
              title={
                lastEventAt
                  ? `Last realtime event ${formatDistanceToNow(lastEventAt, { addSuffix: true })}`
                  : "Subscribed — waiting for the next CI run"
              }
            >
              <Radio size={9} className={liveDotFresh ? "animate-pulse" : ""} />
              live
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-[11px]"
              onClick={exportCsv}
              disabled={latest.errors.length === 0}
              title={
                latest.errors.length === 0
                  ? "No errors to export"
                  : "Download a CSV of every failing error"
              }
            >
              <Download size={12} />
              CSV
            </Button>
            {/* Editor deep-link settings: pin which editor + local repo
                root to use when an operator clicks an error to jump to
                source. Stored in localStorage per operator. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  title={
                    prefs.root
                      ? `Open in ${prefs.editor} · root: ${prefs.root}`
                      : "Configure editor deep-links"
                  }
                >
                  <Settings2
                    size={12}
                    className={prefs.root ? "" : "text-amber-400"}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Editor</Label>
                  <Select
                    value={prefs.editor}
                    onValueChange={(v) =>
                      setPrefs((p) => ({ ...p, editor: v as EditorKind }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vscode">VS Code</SelectItem>
                      <SelectItem value="vscode-insiders">VS Code Insiders</SelectItem>
                      <SelectItem value="cursor">Cursor</SelectItem>
                      <SelectItem value="windsurf">Windsurf</SelectItem>
                      <SelectItem value="jetbrains">JetBrains (WebStorm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Local repo root</Label>
                  <Input
                    value={prefs.root}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, root: e.target.value }))
                    }
                    placeholder="/Users/me/code/cardscanpro"
                    className="h-8 text-xs font-mono"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Absolute path to this repo on your machine. The link joins
                    this with the file path the type-checker reported.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={reload}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* Commit / branch chip line */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {latest.branch && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-mono">
              <GitBranch size={10} />
              {latest.branch}
            </span>
          )}
          {latest.commit_sha && (
            <span className="px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-mono">
              {latest.commit_sha.slice(0, 7)}
            </span>
          )}
          {/* Mini history strip — coloured squares for the last N runs. The
              latest is leftmost; hovering reveals the timestamp + count. */}
          <div className="ml-auto flex items-center gap-0.5">
            {runs.map((r) => (
              <div
                key={r.id}
                title={`${r.succeeded ? "✓ pass" : `✗ ${r.error_count} errors`} · ${formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}`}
                className={cn(
                  "h-3 w-3 rounded-sm",
                  r.succeeded ? "bg-emerald-400/60" : "bg-destructive/70",
                  r.id === latest.id && "ring-1 ring-foreground/30",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Aggregate analytics across the last N runs ── */}
      {analytics.totalErrors > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Trends · last {analytics.runCount} run{analytics.runCount === 1 ? "" : "s"}
            </h4>
            <span className="text-[10px] text-muted-foreground">
              {analytics.failingRuns}/{analytics.runCount} failing
            </span>
          </div>

          {/* Top-level KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total errors</div>
              <div className="text-lg font-semibold text-foreground tabular-nums">{analytics.totalErrors}</div>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg / run</div>
              <div className="text-lg font-semibold text-foreground tabular-nums">{analytics.avgPerRun.toFixed(1)}</div>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Files affected</div>
              <div className="text-lg font-semibold text-foreground tabular-nums">{analytics.uniqueFiles}</div>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Unique codes</div>
              <div className="text-lg font-semibold text-foreground tabular-nums">{analytics.uniqueCodes}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Top files */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground">Top files by error count</div>
              {analytics.topFiles.map(({ file, count }) => {
                const pct = analytics.maxFile > 0 ? (count / analytics.maxFile) * 100 : 0;
                return (
                  <button
                    key={file}
                    onClick={() => {
                      setFilterFile(file);
                      setShowFilters(true);
                    }}
                    className="w-full text-left group"
                    title={`Filter errors to ${file}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] mb-0.5">
                      <span className="font-mono text-foreground/90 truncate group-hover:text-primary">
                        {file}
                      </span>
                      <span className="tabular-nums text-muted-foreground shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full bg-destructive/70 group-hover:bg-destructive transition-colors"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Top codes */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground">Top TS codes by frequency</div>
              {analytics.topCodes.map(({ code, count, severity }) => {
                const pct = analytics.maxCode > 0 ? (count / analytics.maxCode) * 100 : 0;
                return (
                  <button
                    key={code}
                    onClick={() => {
                      setFilterCode(code);
                      setShowFilters(true);
                    }}
                    className="w-full text-left group"
                    title={`Filter errors to ${code}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] mb-0.5">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className={cn("font-mono px-1.5 py-0.5 rounded text-[10px] border shrink-0", severityColor(severity))}>
                          {code}
                        </span>
                        <span className="text-muted-foreground truncate">{severity}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full bg-primary/70 group-hover:bg-primary transition-colors"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      {!latest.succeeded && latest.errors.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search errors by message, file, or code…"
                className="h-8 pl-9 pr-8 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 px-2 gap-1 text-xs", showFilters && "border-primary text-primary")}
              onClick={() => setShowFilters((s) => !s)}
            >
              <Filter size={12} />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[140px] flex-1">
                <Select value={filterFile} onValueChange={(v) => setFilterFile(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All files" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All files</SelectItem>
                    {allFiles.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs font-mono">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[120px] flex-1">
                <Select value={filterSeverity} onValueChange={(v) => setFilterSeverity(v as Severity | "")}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All severities</SelectItem>
                    {allSeverities.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[120px] flex-1">
                <Select value={filterCode} onValueChange={(v) => setFilterCode(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All codes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All codes</SelectItem>
                    {allCodes.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs font-mono">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Result count pill */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              Showing{" "}
              <span className="font-medium text-foreground">
                {groupedErrors.reduce((acc, g) => acc + g.errors.length, 0)}
              </span>{" "}
              of {latest.error_count} error{latest.error_count === 1 ? "" : "s"}
            </span>
            {groupedErrors.length > 0 && (
              <span>· {groupedErrors.length} file{groupedErrors.length === 1 ? "" : "s"}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Per-file error groups ── */}
      {!latest.succeeded && groupedErrors.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {groupedErrors.map(({ file, errors }) => {
            const isOpen = expandedFiles.has(file);
            // File-level deep link opens the file at line 1 in the configured
            // editor. `null` when no root is set — we render a disabled chip
            // pointing at the settings popover so the affordance is still
            // visible but doesn't fire a broken `vscode://` URL.
            const fileUrl = buildEditorUrl(prefs, file, 1, 1);
            return (
              <div key={file} className="border-b border-border last:border-b-0">
                <div className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                  <button
                    onClick={() => toggleFile(file)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown size={12} className="text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                    )}
                    <FileWarning size={12} className="text-destructive shrink-0" />
                    <span className="font-mono text-[11px] text-foreground truncate flex-1">
                      {file}
                    </span>
                  </button>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 border-destructive/30 text-destructive bg-destructive/10"
                  >
                    {errors.length}
                  </Badge>
                  {fileUrl ? (
                    <a
                      href={fileUrl}
                      onClick={(e) => e.stopPropagation()}
                      title={`Open ${file} in ${prefs.editor}`}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span
                      title="Set your editor + repo root via the gear icon above to enable one-click open"
                      className="p-1 rounded text-muted-foreground/40 cursor-help"
                    >
                      <ExternalLink size={11} />
                    </span>
                  )}
                </div>
                {isOpen && (
                  <div className="bg-muted/20 px-4 py-2 space-y-1.5">
                    {errors.map((err, i) => {
                      const errUrl = buildEditorUrl(prefs, err.file, err.line, err.column);
                      const sev = severityOf(err.code);
                      return (
                        <div
                          key={`${err.line}-${err.column}-${i}`}
                          className="flex items-start gap-2 text-[11px]"
                        >
                          {/* TS code chip + severity */}
                          <span className={cn("font-mono px-1.5 py-0.5 rounded shrink-0 text-[10px] border", severityColor(sev))}>
                            {err.code}
                          </span>
                          {/* The line:col token is itself the deep link when
                              editor prefs are configured — clicking jumps
                              straight to the failing position. Falls back to
                              a plain span (with a hint) when not set. */}
                          {errUrl ? (
                            <a
                              href={errUrl}
                              title={`Open ${err.file}:${err.line}:${err.column} in ${prefs.editor}`}
                              className="font-mono text-primary hover:underline shrink-0 inline-flex items-center gap-1"
                            >
                              {err.line}:{err.column}
                              <ExternalLink size={9} className="opacity-60" />
                            </a>
                          ) : (
                            <span
                              title="Configure editor + repo root (gear icon) to make this clickable"
                              className="font-mono text-muted-foreground shrink-0"
                            >
                              {err.line}:{err.column}
                            </span>
                          )}
                          <span className="text-foreground/90 break-words flex-1">
                            {err.message}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default TypecheckPanel;
