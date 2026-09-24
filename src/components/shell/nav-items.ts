import type { LucideIcon } from "lucide-react";
import { Home, Compass, PlusSquare, MessageCircle, User, Bookmark } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Not built yet (DMs land in a later phase) — shown but routes to a stub. */
  comingSoon?: boolean;
}

export function buildNavItems(username?: string): NavItem[] {
  return [
    { label: "Home", href: "/home", icon: Home },
    { label: "Explore", href: "/explore", icon: Compass },
    { label: "Create", href: "/home?compose=1", icon: PlusSquare },
    ...(username ? [{ label: "Bookmarks", href: "/bookmarks", icon: Bookmark }] : []),
    { label: "Messages", href: "/messages", icon: MessageCircle, comingSoon: true },
    { label: "Profile", href: username ? `/${username}` : "/login", icon: User },
  ];
}
