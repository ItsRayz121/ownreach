import type { LucideIcon } from "lucide-react";
import { Compass, PlusSquare, MessageCircle, User, Users } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

export function buildNavItems(username?: string): NavItem[] {
  return [
    { label: "Explore", href: "/explore", icon: Compass },
    ...(username ? [{ label: "Chats", href: "/messages", icon: MessageCircle }] : []),
    { label: "Create", href: "/home?compose=1", icon: PlusSquare },
    ...(username ? [{ label: "Communities", href: "/communities", icon: Users }] : []),
    { label: "Profile", href: username ? `/${username}` : "/login", icon: User },
  ];
}
