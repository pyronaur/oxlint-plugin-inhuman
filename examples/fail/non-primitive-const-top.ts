export const CONFIG = { retries: 3 };

function compute(value: string) {
  return value.trim();
}

export function format(value: string) {
  const trimmed = compute(value);
  return trimmed;
}
