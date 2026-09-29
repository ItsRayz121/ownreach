import type { LucideIcon } from "lucide-react";
import { Radio, PlusSquare, MessageCircle, User, Users } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
  badge?: boolean | number;
}

export interface NavUnread {
  messages?: number;
  groups?: boolean;
  channels?: boolean;
  /** Unread notifications — shown on the Profile tab on phones, where notifications now live. */
  notifications?: boolean;
}

export function buildNavItems(username?: string, unread: NavUnread = {}, canPost = false): NavItem[] {
  return [
    ...(username ? [{ label: "Chats", href: "/messages", icon: MessageCircle, badge: unread.messages }] : []),
    ...(username ? [{ label: "Groups", href: "/communities?kind=group", icon: Users, badge: unread.groups }] : []),
    ...(canPost ? [{ label: "Create", href: "/home?compose=1", icon: PlusSquare }] : []),
    ...(username ? [{ label: "Channels", href: "/communities?kind=channel", icon: Radio, badge: unread.channels }] : []),
    { label: "Profile", href: username ? `/${username}` : "/login", icon: User, badge: unread.notifications },
  ];
}

/**
 * Groups and Channels share the `/communities` path and are only
 * distinguished by a `kind` query param, which `usePathname()` doesn't see —
 * so a plain prefix check would light up both tabs at once. This compares
 * query params explicitly for any item whose href carries them.
 */
export function isNavItemActive(item: NavItem, pathname: string, searchParams?: URLSearchParams | null): boolean {
  if (item.href === "/home?compose=1") return false; // Create is an action, not a section
  const [itemPath, itemQuery] = item.href.split("?");
  if (itemQuery) {
    if (pathname !== itemPath) return false;
    const itemParams = new URLSearchParams(itemQuery);
    return Array.from(itemParams.entries()).every(([key, value]) => (searchParams?.get(key) ?? "") === value);
  }
  return pathname === itemPath || pathname.startsWith(itemPath);
}
