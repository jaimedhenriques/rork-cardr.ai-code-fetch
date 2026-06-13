import { z } from "zod";

/**
 * Schema for the `check-subscription` edge function response.
 *
 * The function may legitimately return a partial payload when the user has
 * no Stripe customer (just `{ subscribed: false }`), so most fields are
 * optional. We only reject responses that are structurally broken or carry
 * inconsistent state (e.g. `subscribed: true` with no plan).
 */
export const CheckSubscriptionResponseSchema = z
  .object({
    subscribed: z.boolean(),
    plan: z
      .enum(["starter", "pro", "business", "teams", "free", "pro_plus"])
      .optional()
      .nullable(),
    product_id: z.string().nullable().optional(),
    subscription_end: z.string().datetime().nullable().optional(),
    error: z.string().optional(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    // Edge function reported its own error — surface it.
    if (val.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Server error: ${val.error}`,
      });
      return;
    }
    // Subscribed users must have a plan and an end date — anything else
    // means the server's view of the subscription is incomplete.
    if (val.subscribed) {
      if (!val.plan || val.plan === "starter" || val.plan === "free") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Marked subscribed but plan tier is missing",
        });
      }
      if (!val.subscription_end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Marked subscribed but renewal date is missing",
        });
      }
    }
  });

export type CheckSubscriptionResponse = z.infer<typeof CheckSubscriptionResponseSchema>;

export interface ParsedSubscription {
  subscribed: boolean;
  plan: string;
  productId: string | null;
  subscriptionEnd: string | null;
}

export interface ParseResult {
  ok: boolean;
  data?: ParsedSubscription;
  /** Human-readable summary suitable for showing in a banner/toast. */
  message?: string;
  /** Detailed issue list (for logs / debugging). */
  issues?: string[];
}

const normalisePlan = (raw: string | null | undefined): string => {
  if (!raw) return "starter";
  const lower = raw.toLowerCase();
  if (lower === "free") return "starter";
  if (lower === "pro_plus") return "business";
  return lower;
};

/**
 * Parse and validate the raw `check-subscription` payload. Returns a
 * normalised result on success, or an `ok: false` error with a clear
 * user-facing message when the response is malformed / inconsistent.
 */
export const parseCheckSubscription = (raw: unknown): ParseResult => {
  if (raw == null) {
    return {
      ok: false,
      message: "We didn't get a response from our subscription service. Try again in a moment.",
    };
  }
  const result = CheckSubscriptionResponseSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message);
    return {
      ok: false,
      issues,
      message:
        "We received an unexpected response from our subscription service. " +
        "Your plan may not be fully up to date — please try again or sign in at cardr.ai.",
    };
  }
  const v = result.data;
  return {
    ok: true,
    data: {
      subscribed: v.subscribed,
      plan: normalisePlan(v.plan),
      productId: v.product_id ?? null,
      subscriptionEnd: v.subscription_end ?? null,
    },
  };
};
