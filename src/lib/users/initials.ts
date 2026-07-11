export function getInitials(displayName: string | null, username: string): string {
  const source = displayName !== null && displayName.length > 0 ? displayName : username;
  return source
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
