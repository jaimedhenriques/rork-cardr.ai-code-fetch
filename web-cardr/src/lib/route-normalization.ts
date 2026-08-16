// CARDR-ROUTE-NORMALIZATION-CANONICAL-20260809
// Prefix a legacy flat path with /app exactly once. Paths already in the
// /app namespace must not grow into /app/app/...
export const getLegacyFlatRedirectTarget = (
  pathname: string,
  search: string,
  hash: string,
) => {
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    return null;
  }

  return `/app${pathname}${search}${hash}`;
};
