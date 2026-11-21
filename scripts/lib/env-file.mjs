// Tiny helpers for reading/updating KEY="value" lines in a .env file without extra dependencies.

/** @param {string} text @param {string} key */
export function getEnvValue(text, key) {
  const m = text.match(new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*(.*)$`, "m"));
  if (!m) return undefined;
  let v = (m[1] ?? "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

/** Replaces (or appends) KEY="value". Keeps line endings and the rest of the file intact. */
export function setEnvValue(text, key, value) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const line = `${key}="${String(value).replace(/"/g, '\\"')}"`;
  const re = new RegExp(`^[ \\t]*${key}[ \\t]*=.*$`, "m");
  if (re.test(text)) return text.replace(re, line);
  return `${text.replace(/\s*$/, "")}${eol}${line}${eol}`;
}

/** True when the auth secret is missing, too short or still the example placeholder. */
export function isWeakSecret(value) {
  return !value || value.length < 32 || value.startsWith("replace-with");
}

/** Strong random password: 18+ chars, letters, digits and a symbol, no look-alike characters. */
export function strongPassword(randomBytes) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 6)}-${out.slice(6, 12)}-${out.slice(12)}7a`;
}

/** Port of a local (localhost/127.0.0.1) DATABASE_URL, or undefined for remote databases. */
export function localDbPort(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    if (!["localhost", "127.0.0.1"].includes(u.hostname)) return undefined;
    return u.port || "5432";
  } catch {
    return undefined;
  }
}
