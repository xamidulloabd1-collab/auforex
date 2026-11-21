export type DbFailureKind = "ok" | "auth" | "nodb" | "refused" | "dns" | "timeout" | "other";
export function classifyDbError(err: unknown): { kind: DbFailureKind; message: string };
export function probeDb(url: string, opts?: { timeoutMs?: number }): Promise<{ ok: boolean; kind: DbFailureKind; message: string }>;
export function parseDbUrl(url: string): { host: string; port: number; user: string; password: string; database: string };
export function isLocalHost(host: string): boolean;
export function withHostPort(url: string, host: string, port: number): string;
export function portInUse(port: number): Promise<boolean>;
export function findFreePort(start?: number, avoid?: number[]): Promise<number>;
export function explainDbFailure(kind: string, cfg?: { host?: string; port?: number; user?: string }): string;
