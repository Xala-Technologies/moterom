/** Customer “my account” routes — not a useful admin landing after login. */
function isCustomerAccountPath(pathname: string): boolean {
  return (
    pathname === "/meldinger" ||
    pathname.startsWith("/meldinger/") ||
    pathname === "/mine-bookinger" ||
    pathname.startsWith("/mine-bookinger/") ||
    pathname.startsWith("/booking/")
  );
}

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
  // Admins always land on Oversikt after login — not a deep admin returnTo
  // or the previous customer inbox/bookings URL (Messages.tsx would otherwise
  // bounce /meldinger → /admin/messages). Mid-booking paths stay intact.
  if (
    user?.isAdmin &&
    (adminRoute ||
      pathname === "/" ||
      pathname === "" ||
      isCustomerAccountPath(pathname))
  )
    return "/admin";
  return path;
}
