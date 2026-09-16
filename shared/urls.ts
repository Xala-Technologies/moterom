export function listingUrl(dashboardUrl: string, slug: string) {
  const url = new URL(dashboardUrl);
  url.hostname = url.hostname.replace(/^dashboard\./, "app.");
  url.pathname = `/listing/${encodeURIComponent(slug)}`;
  url.search = "";
  url.hash = "";
  return url.href;
}
