import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Authenticated, Unauthenticated } from "convex/react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export function FollowButton({ userId, sellerName }: { userId: Id<"users">; sellerName?: string }) {
  const isFollowing = useQuery((api.follows as any).isFollowing, { userId }) as boolean | undefined;
  const counts = useQuery((api.follows as any).getFollowCounts, { userId }) as
    | { followers: number; following: number }
    | undefined;
  const follow = useMutation((api.follows as any).follow);
  const unfollow = useMutation((api.follows as any).unfollow);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        await unfollow({ userId });
        toast.success(`Unfollowed ${sellerName ?? "user"}`);
      } else {
        await follow({ userId });
        toast.success(`Following ${sellerName ?? "user"} — you'll see their new products`);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <Button
          variant={isFollowing ? "secondary" : "default"}
          size="sm"
          onClick={toggle}
          disabled={loading || isFollowing === undefined}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isFollowing ? (
            <UserCheck className="size-3.5" />
          ) : (
            <UserPlus className="size-3.5" />
          )}
          {isFollowing ? "Following" : "Follow"}
        </Button>
      </Authenticated>
      {counts && (
        <span className="text-xs text-muted-foreground">
          {counts.followers} follower{counts.followers !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
