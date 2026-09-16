export default async function handler(req, res) {
  const { default: app } = await import("./app.bundle.js");
  return app(req, res);
}
