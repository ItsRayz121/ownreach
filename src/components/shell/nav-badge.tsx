/** Numbered pill for an unread count, or a plain dot for a boolean "something's new" signal — shared by the desktop sidebar and mobile bottom nav. */
export function NavBadge({ badge }: { badge: boolean | number | undefined }) {
  if (typeof badge === "number" && badge > 0) {
    return (
      <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-semibold">
        {badge > 99 ? "99+" : badge}
      </span>
    );
  }
  if (badge === true) {
    return <span className="bg-primary absolute -top-1 -right-1 size-2 rounded-full" />;
  }
  return null;
}
