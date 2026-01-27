type InternalOptions = {
  uppercase?: boolean;
};

export type PublicOptions = InternalOptions;

const suffix = "!";

function format(value, options) {
  const text = String(value).trim();
  return options?.uppercase ? text.toUpperCase() : text;
}

export function shout(value, options) {
  return format(value, options) + suffix;
}
