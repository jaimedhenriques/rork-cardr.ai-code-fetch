import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Edge functions: forbid direct @supabase/supabase-js imports. Every
  // function MUST route through supabase/functions/_shared/supabase-client.ts
  // so the SDK version stays pinned in exactly one place. The CI script
  // `scripts/verify-supabase-js-pin.ts` enforces the same rule repo-wide;
  // this lint rule surfaces violations inside the editor for a faster
  // feedback loop. The shared module itself is the one legitimate exception.
  {
    files: ["supabase/functions/**/*.{ts,tsx}"],
    ignores: ["supabase/functions/_shared/supabase-client.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, Deno: "readonly" },
    },
    rules: {
      // Use a simple regex literal in the selector. esquery's substring
      // operator (`*=`) does not reliably match string-valued AST nodes,
      // and complex escaped regexes (with `\/`) can fail to parse — keep
      // the pattern minimal: any source value containing "supabase-js".
      // That's specific enough because the shared module (the only file
      // that legitimately spells the SDK out) is excluded above.
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/supabase-js/]",
          message:
            "Import @supabase/supabase-js via '../_shared/supabase-client.ts' instead of pinning the SDK directly. See scripts/verify-supabase-js-pin.ts.",
        },
        {
          selector: "ImportExpression[source.value=/supabase-js/]",
          message:
            "Dynamic import of @supabase/supabase-js must go through '../_shared/supabase-client.ts' to keep the SDK version pinned in one place.",
        },
        {
          selector:
            "ExportAllDeclaration[source.value=/supabase-js/], ExportNamedDeclaration[source.value=/supabase-js/]",
          message:
            "Re-export @supabase/supabase-js from '../_shared/supabase-client.ts' instead of pinning the SDK directly.",
        },
      ],
    },
  },
);
