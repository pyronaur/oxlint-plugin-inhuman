export function renderUser(user) {
  if (!user) return "anonymous";
  return user.name.toUpperCase();
}
