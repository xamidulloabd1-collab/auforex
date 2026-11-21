// Copies the pdf.js worker into /public so the PDF reader can load it from our own origin.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const target = path.join(process.cwd(), "public", "pdfjs");
mkdirSync(target, { recursive: true });
copyFileSync(path.join(pkgDir, "build", "pdf.worker.min.mjs"), path.join(target, "pdf.worker.min.mjs"));
console.log("pdf.js worker copied to public/pdfjs");
