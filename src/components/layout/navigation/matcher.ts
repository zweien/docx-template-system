function normalizePath(pathname: string) {
  if (pathname === "/") {
    return "/";
  }

  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : "/";
}

export function isRouteActive(itemHref: string, pathname: string) {
  const normalizedHref = normalizePath(itemHref);
  const normalizedPathname = normalizePath(pathname);

  if (normalizedHref === "/") {
    return normalizedPathname === "/";
  }

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}
