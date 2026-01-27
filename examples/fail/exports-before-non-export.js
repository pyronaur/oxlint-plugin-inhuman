export const format = (value) => String(value).trim();

const suffix = "!";

export function shout(value) {
  return format(value) + suffix;
}
