import { UserAvatar } from "@/components/user-avatar";
import type { FriendWatch } from "@/types/recommendation-responses";

/**
 * Section aside for collaborative recommendations: an overlapping stack of the
 * friends whose ratings drove the section, plus their names. Presentation only,
 * fed by the `watchedByFriends` already carried on each RecommendationItem
 * (deduped across the section's items by the page before being passed here).
 */

const MAX_AVATARS = 4;
const MAX_NAMES = 3;

interface FriendStackProps {
  readonly friends: readonly FriendWatch[];
}

export function FriendStack({ friends }: FriendStackProps) {
  if (friends.length === 0) return null;

  const shown = friends.slice(0, MAX_AVATARS);
  const overflow = friends.length - shown.length;

  const names = friends.slice(0, MAX_NAMES).map((friend) => friend.displayName ?? friend.username);
  const extraNames = friends.length - names.length;
  const nameLine =
    extraNames > 0 ? `${names.join(" · ")} +${String(extraNames)}` : names.join(" · ");

  return (
    <div className="flex items-center gap-2">
      <div className="*:ring-background flex -space-x-2 *:ring-2">
        {shown.map((friend) => (
          <UserAvatar
            key={friend.username}
            displayName={friend.displayName}
            username={friend.username}
            size="sm"
            fallbackClassName="text-[10px]"
          />
        ))}
        {overflow > 0 && (
          <span className="bg-muted text-muted-foreground ring-background flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] ring-2">
            +{String(overflow)}
          </span>
        )}
      </div>
      <span className="text-muted-foreground hidden text-xs sm:inline">{nameLine}</span>
    </div>
  );
}
