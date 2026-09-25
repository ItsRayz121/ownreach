import { UserAvatar } from "@/components/user-avatar";

interface Member {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export function MemberAvatarStack({ members, max = 4 }: { members: Member[]; max?: number }) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;

  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <span key={m.userId} className={i > 0 ? "-ml-2" : undefined}>
          <UserAvatar src={m.avatarUrl} name={m.displayName} className="border-background size-6 border-2" />
        </span>
      ))}
      {overflow > 0 && (
        <span className="bg-muted text-muted-foreground border-background -ml-2 flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-medium">
          +{overflow}
        </span>
      )}
    </div>
  );
}
