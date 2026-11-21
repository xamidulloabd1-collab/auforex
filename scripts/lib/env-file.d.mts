export function getEnvValue(text: string, key: string): string | undefined;
export function setEnvValue(text: string, key: string, value: string): string;
export function isWeakSecret(value: string | undefined): boolean;
export function strongPassword(randomBytes: (size: number) => Uint8Array): string;
export function localDbPort(databaseUrl: string | undefined): string | undefined;
