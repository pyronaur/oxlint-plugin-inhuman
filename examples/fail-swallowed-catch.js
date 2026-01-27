export function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch (err) {
    // ignore: bad input
  }
}
