import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  src?: string | null;
  name: string;
  className?: string;
}

export function UserAvatar({ src, name, className }: UserAvatarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Avatar className={cn(className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback className="bg-accent text-accent-foreground font-medium">{initials || "?"}</AvatarFallback>
    </Avatar>
  );
}
