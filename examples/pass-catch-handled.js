export function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch (err) {
    console.error("Failed to parse JSON", err);
    return null;
  }
}
