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
