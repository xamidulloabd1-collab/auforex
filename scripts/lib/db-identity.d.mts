export function databaseIdentity(raw: string | null | undefined): string | null;
export function sameDatabase(a: string | null | undefined, b: string | null | undefined): boolean;
export function databaseFingerprint(raw: string | null | undefined): string | null;
export function previewDatabaseMismatch(source: Record<string, string | undefined>): string | null;
