export default async function handler(req, res) {
  const { default: app } = await import("./_app.bundle.js");
  return app(req, res);
}
