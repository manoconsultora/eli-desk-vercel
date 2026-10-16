export function isPlatformNavigationActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return href !== "/platform" && pathname.startsWith(`${href}/`);
}
