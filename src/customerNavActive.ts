/** Sidebar active state for customer dashboard links. */
export function customerNavActive(to: string, pathname: string): boolean {
  if (to === "/mine-bookinger") {
    return (
      pathname.startsWith("/mine-bookinger") || pathname.startsWith("/booking/")
    );
  }
  if (to === "/meldinger") {
    return pathname.startsWith("/meldinger");
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}
