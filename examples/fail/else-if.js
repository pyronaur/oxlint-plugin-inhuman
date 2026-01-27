export function getTier(score) {
  if (score >= 90) {
    return "A";
  } else if (score >= 80) {
    return "B";
  }

  return "C";
}
