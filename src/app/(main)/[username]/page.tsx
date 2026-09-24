import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, LinkIcon, MapPin, BadgeCheck, FileText } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { getProfileByUsername, getProfileCounts } from "@/lib/data/profiles";
import { isFollowing } from "@/lib/data/follows";
import { getPostsByAuthor } from "@/lib/data/posts";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/profile/follow-button";
import { PostCard } from "@/components/post/post-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  return { title: `${profile.displayName} (@${profile.username}) / OwnReach` };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [profile, session] = await Promise.all([getProfileByUsername(username), verifySession()]);
  if (!profile) notFound();

  const isOwnProfile = session?.userId === profile.userId;

  const [counts, following, { items: posts }] = await Promise.all([
    getProfileCounts(profile.userId),
    session && !isOwnProfile ? isFollowing(session.userId, profile.userId) : Promise.resolve(false),
    getPostsByAuthor(profile.userId, session?.userId),
  ]);

  return (
    <div>
      <div className="bg-muted relative h-36 sm:h-48">
        {profile.coverUrl && <Image src={profile.coverUrl} alt="" fill className="object-cover" priority />}
      </div>

      <div className="px-4">
        <div className="-mt-12 flex items-end justify-between">
          <UserAvatar
            src={profile.avatarUrl}
            name={profile.displayName}
            className="border-background size-24 border-4"
          />
          {isOwnProfile ? (
            <Button render={<Link href="/settings/profile" />} nativeButton={false} variant="outline">
              Edit profile
            </Button>
          ) : session ? (
            <FollowButton targetUserId={profile.userId} targetUsername={profile.username} initiallyFollowing={following} />
          ) : (
            <Button render={<Link href="/login" />} nativeButton={false}>Follow</Button>
          )}
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-semibold">{profile.displayName}</h1>
            {profile.isCreator && <BadgeCheck className="text-primary size-5" aria-label="Creator" />}
          </div>
          <p className="text-muted-foreground text-sm">@{profile.username}</p>
        </div>

        {profile.bio && <p className="mt-3 text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap">{profile.bio}</p>}

        <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {profile.location}
            </span>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary flex items-center gap-1 hover:underline"
            >
              <LinkIcon className="size-3.5" />
              {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            Joined{" "}
            {profile.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </div>

        <div className="mt-3 flex gap-4 text-sm">
          <span>
            <strong>{counts.following}</strong> <span className="text-muted-foreground">Following</span>
          </span>
          <span>
            <strong>{counts.followers}</strong> <span className="text-muted-foreground">Followers</span>
          </span>
          <span>
            <strong>{counts.posts}</strong> <span className="text-muted-foreground">Posts</span>
          </span>
        </div>
      </div>

      <div className="mt-4 border-t">
        {posts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No posts yet"
            description={isOwnProfile ? "Share your first post from the Home tab." : `@${profile.username} hasn't posted yet.`}
          />
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} isAuthenticated={Boolean(session)} />)
        )}
      </div>
    </div>
  );
}
