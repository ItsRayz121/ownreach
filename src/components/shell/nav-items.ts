import type { LucideIcon } from "lucide-react";
import { Home, Compass, PlusSquare, MessageCircle, User, Bookmark } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

export function buildNavItems(username?: string): NavItem[] {
  return [
    { label: "Home", href: "/home", icon: Home },
    { label: "Explore", href: "/explore", icon: Compass },
    { label: "Create", href: "/home?compose=1", icon: PlusSquare },
    ...(username ? [{ label: "Bookmarks", href: "/bookmarks", icon: Bookmark }] : []),
    ...(username ? [{ label: "Messages", href: "/messages", icon: MessageCircle }] : []),
    { label: "Profile", href: username ? `/${username}` : "/login", icon: User },
  ];
}
