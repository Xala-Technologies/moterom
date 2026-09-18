/** Safe in-app path after login. Non-admins never land on /admin. */
export function postLoginPath(
  candidate: string | null | undefined,
  user?: { isAdmin?: boolean } | null,
): string {
  const path =
    candidate &&
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\")
      ? candidate
      : "/";
  const pathname = path.split("?")[0]?.split("#")[0] || "/";
  const adminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  if (adminRoute && !user?.isAdmin) return "/";
  if ((pathname === "/" || pathname === "") && user?.isAdmin) return "/admin";
  return path;
}
