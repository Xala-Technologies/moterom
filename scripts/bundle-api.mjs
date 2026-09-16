import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["api/entry.ts"],
  outfile: "api/app.bundle.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  logLevel: "info",
});
