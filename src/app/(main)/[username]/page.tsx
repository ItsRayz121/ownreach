import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, LinkIcon, MapPin, BadgeCheck, Bookmark, Bell, Settings, LogOut, ChevronRight } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { logout } from "@/lib/actions/auth";
import { getProfileByUsername, getSocialLinks } from "@/lib/data/profiles";
import { isFollowing } from "@/lib/data/follows";
import { getPostsByAuthor } from "@/lib/data/posts";
import { unreadNotificationCount } from "@/lib/data/notifications";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/profile/follow-button";
import { MessageButton } from "@/components/profile/message-button";
import { PostCard } from "@/components/post/post-card";
import { Button } from "@/components/ui/button";
import { SocialIcon } from "@/components/social-icon";
import { ProfileHeaderActions } from "@/components/shell/profile-header-actions";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/social-platforms";

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

  const [following, { items: posts }, socialLinks, unreadNotifications] = await Promise.all([
    session && !isOwnProfile ? isFollowing(session.userId, profile.userId) : Promise.resolve(false),
    getPostsByAuthor(profile.userId, session?.userId),
    getSocialLinks(profile.userId),
    isOwnProfile ? unreadNotificationCount(profile.userId) : Promise.resolve(0),
  ]);

  return (
    <div>
      {/* No banner placeholder: without a cover the initials avatar sits at the top instead of under an empty grey block. */}
      {profile.coverUrl && (
        <div className="bg-muted relative h-36 sm:h-48">
          <Image src={profile.coverUrl} alt="" fill className="object-cover" priority />
        </div>
      )}

      <div className="px-4">
        <div className={profile.coverUrl ? "-mt-12 flex items-end justify-between" : "flex items-end justify-between pt-6"}>
          <UserAvatar
            src={profile.avatarUrl}
            name={profile.displayName}
            className={profile.coverUrl ? "border-background size-24 border-4 text-3xl" : "size-24 text-3xl"}
          />
          {isOwnProfile ? (
            <div className="flex items-center gap-2">
              <Button render={<Link href="/settings/profile" />} nativeButton={false} variant="outline">
                Edit profile
              </Button>
              {/* Phones get these in the top bar; it is hidden on desktop. */}
              <ProfileHeaderActions userId={session?.userId} unreadNotifications={unreadNotifications} className="hidden items-center md:flex" />
            </div>
          ) : session ? (
            <div className="flex items-center gap-2">
              <MessageButton targetUserId={profile.userId} />
              <FollowButton targetUserId={profile.userId} targetUsername={profile.username} initiallyFollowing={following} />
            </div>
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

        {socialLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {socialLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.platform === "other" ? (link.label ?? "Link") : SOCIAL_PLATFORM_LABELS[link.platform]}
                title={link.platform === "other" ? (link.label ?? "Link") : SOCIAL_PLATFORM_LABELS[link.platform]}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/60 flex size-8 items-center justify-center rounded-full border"
              >
                <SocialIcon platform={link.platform} className="size-4" />
              </a>
            ))}
          </div>
        )}

        {/* Posts / followers / following counts are hidden until those features are live. */}
      </div>

      {isOwnProfile && (
        <nav aria-label="Account" className="mt-6 border-t">
          <ProfileRow href="/bookmarks" icon={Bookmark} label="Saved" />
          <ProfileRow href="/notifications" icon={Bell} label="Notifications" />
          <ProfileRow href="/settings/account" icon={Settings} label="Account settings" />
          <form action={logout}>
            <button type="submit" className="hover:bg-accent/40 text-destructive flex w-full items-center gap-3 border-b px-4 py-3.5 text-left text-[15px] font-medium transition-colors">
              <LogOut className="size-5" />
              Log out
            </button>
          </form>
        </nav>
      )}

      {posts.length > 0 && (
        <div className="mt-4 border-t">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} isAuthenticated={Boolean(session)} viewerId={session?.userId} viewerRole={session?.role} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileRow({ href, icon: Icon, label }: { href: string; icon: typeof Bell; label: string }) {
  return (
    <Link href={href} className="hover:bg-accent/40 flex items-center gap-3 border-b px-4 py-3.5 text-[15px] font-medium transition-colors">
      <Icon className="text-muted-foreground size-5" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="text-muted-foreground size-4" />
    </Link>
  );
}
