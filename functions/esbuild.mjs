/**
 * Bundles the Cloud Functions into a single self-contained ESM file so Firebase's cloud build
 * doesn't have to resolve the pnpm `workspace:*` dependency on @orbit/core. The shared core is
 * inlined via an alias to its compiled output; the heavy npm SDKs stay external and are installed
 * in the cloud from this package's `dependencies`.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: path.join(here, "lib/index.js"),
  // Inline the workspace package from its built output.
  alias: {
    "@orbit/core": path.join(here, "../packages/core/dist/index.js"),
  },
  // Keep npm dependencies external — installed in the cloud from package.json.
  external: [
    "firebase-admin",
    "firebase-admin/*",
    "firebase-functions",
    "firebase-functions/*",
    "@anthropic-ai/sdk",
    "googleapis",
    "twilio",
    "fast-xml-parser",
  ],
  // Some external CJS deps expect `require`/`__dirname` to exist in the ESM output.
  banner: {
    js: [
      "import { createRequire as __cr } from 'module';",
      "import { fileURLToPath as __f } from 'url';",
      "import { dirname as __d } from 'path';",
      "const require = __cr(import.meta.url);",
      "const __filename = __f(import.meta.url);",
      "const __dirname = __d(__filename);",
    ].join(""),
  },
  logLevel: "info",
});
