export function renderStatus(status) {
  switch (status) {
    case "ok":
      return "ok";
    default:
      return "unknown";
  }
}
