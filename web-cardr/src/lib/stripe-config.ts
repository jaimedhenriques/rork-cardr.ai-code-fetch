/** Stripe product/price mapping for Cardr plans */
export const STRIPE_PLANS = {
  pro: {
    product_id: "prod_UI5bMdz6lFaUH8",
    monthly_price_id: "price_1TJVQTGUUrbawRUokowTq9VP",   // $9.99/mo
    annual_price_id: "price_1TJWALGUUrbawRUo6M6hbeVb",     // $95.88/yr ($7.99/mo)
  },
  business: {
    product_id: "prod_UI5bY6uVXvNrgV",
    monthly_price_id: "price_1TJVQfGUUrbawRUoS3z0Dild",    // $18/mo
    annual_price_id: "price_1TJWAMGUUrbawRUoQ3fkX6S9",     // $168/yr ($14/mo)
  },
} as const;

/** Map Stripe product IDs back to plan names */
export const PRODUCT_TO_PLAN: Record<string, "pro" | "business"> = {
  [STRIPE_PLANS.pro.product_id]: "pro",
  "prod_UI6NOQ5zDk0VWW": "pro",       // Annual Pro product
  "prod_UI5bBQYDHPSqhd": "pro",       // Legacy annual
  [STRIPE_PLANS.business.product_id]: "business",
  "prod_UI6Nto1QKCkydY": "business",   // Annual Business product
  "prod_UI5b6mGp7qqLxz": "business",   // Legacy annual
};
