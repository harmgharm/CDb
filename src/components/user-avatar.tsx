import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/users/initials";
import { cn } from "@/lib/utils";

export function UserAvatar({
  displayName,
  username,
  avatarUrl,
  size,
  className,
  fallbackClassName,
}: Readonly<{
  displayName: string | null;
  username: string;
  avatarUrl?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
  fallbackClassName?: string;
}>) {
  const name = displayName !== null && displayName.length > 0 ? displayName : username;

  return (
    <Avatar size={size} className={cn(className)}>
      <AvatarImage src={avatarUrl ?? undefined} alt={name} />
      <AvatarFallback className={cn(fallbackClassName)}>
        {getInitials(displayName, username)}
      </AvatarFallback>
    </Avatar>
  );
}
