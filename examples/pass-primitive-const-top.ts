export const VERSION = "1.0.0";
export const DEFAULT_TIMEOUT_MS = 1_000;
export const IS_ENABLED = true;
export const NOTHING = null;

function compute(value: string) {
  return value.trim();
}

export function format(value: string) {
  const trimmed = compute(value);
  return trimmed;
}
