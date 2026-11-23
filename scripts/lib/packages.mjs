// No third-party imports here: this must work even when node_modules is incomplete.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Package names from package.json that are not installed in node_modules. */
export function missingPackages(root = process.cwd(), { dev = true } = {}) {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const names = Object.keys({ ...(pkg.dependencies ?? {}), ...(dev ? (pkg.devDependencies ?? {}) : {}) });
  return names.filter((n) => !existsSync(path.join(root, "node_modules", ...n.split("/"), "package.json")));
}
