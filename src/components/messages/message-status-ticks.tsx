import { Circle, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type MessageStatus = "pending" | "sent" | "delivered" | "read";

export function MessageStatusTicks({ status, className }: { status: MessageStatus; className?: string }) {
  if (status === "pending") return <Circle className={cn("size-3", className)} />;
  if (status === "sent") return <Check className={cn("size-3.5", className)} />;
  return <CheckCheck className={cn("size-3.5", status === "read" && "text-sky-400", className)} />;
}
