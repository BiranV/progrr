export function isPublicBookingPathname(pathname: string) {
  return pathname.startsWith("/b") || pathname.startsWith("/public");
}

export function isPublicPagePathname(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/review") ||
    isPublicBookingPathname(pathname)
  );
}
