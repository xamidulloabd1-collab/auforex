export type EnvMode = "development" | "production" | "test";
export type KeyInfo = {
  state: "set" | "empty" | "missing";
  source: string | null;
  shadows: string | null;
  ignoredIn: string[];
};
export function envFilesFor(mode: EnvMode): string[];
export function currentMode(env?: NodeJS.ProcessEnv): EnvMode;
export function loadProjectEnv(root?: string, mode?: EnvMode): string[];
export function describeEnv(opts: {
  root?: string;
  mode?: EnvMode;
  keys: string[];
  initialEnv?: Record<string, string | undefined>;
}): { files: string[]; keys: Record<string, KeyInfo> };
export function explainMissing(key: string, info: KeyInfo, mode: EnvMode): string;
export function describeDbUrl(url: string): {
  target: string;
  host: string;
  port: number;
  kind: "local" | "prisma-direct" | "prisma-pooled" | "accelerate" | "remote" | "invalid";
};
export function dotEnvOverrideWarnings(root: string, keys: string[], mode?: EnvMode): string[];
