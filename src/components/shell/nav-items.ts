import type { LucideIcon } from "lucide-react";
import { Compass, PlusSquare, MessageCircle, User, Users } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
  badge?: boolean;
}

export interface NavUnread {
  messages?: boolean;
  communities?: boolean;
}

export function buildNavItems(username?: string, unread: NavUnread = {}): NavItem[] {
  return [
    { label: "Explore", href: "/explore", icon: Compass },
    ...(username ? [{ label: "Chats", href: "/messages", icon: MessageCircle, badge: unread.messages }] : []),
    { label: "Create", href: "/home?compose=1", icon: PlusSquare },
    ...(username ? [{ label: "Communities", href: "/communities", icon: Users, badge: unread.communities }] : []),
    { label: "Profile", href: username ? `/${username}` : "/login", icon: User },
  ];
}
