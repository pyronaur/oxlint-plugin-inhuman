export function formatName(user) {
  if (!user) {
    return "anonymous";
  } else {
    return user.name;
  }
}
