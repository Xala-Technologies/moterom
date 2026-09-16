import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["server/vercel-entry.ts"],
  outfile: "api/_app.bundle.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  logLevel: "info",
});
