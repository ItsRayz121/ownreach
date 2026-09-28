"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaSummary } from "@/lib/data/media";

interface MediaMessageCardProps {
  media: MediaSummary;
  mine?: boolean;
  onDelete?: () => void;
}

export function MediaMessageCard({ media, mine, onDelete }: MediaMessageCardProps) {
  if (media.removed || !media.url) {
    return (
      <p className={cn("flex items-center gap-1.5 text-sm italic", mine ? "opacity-80" : "text-muted-foreground")}>
        This photo is no longer available.
      </p>
    );
  }

  return (
    <div className="group/media relative max-w-72 overflow-hidden rounded-xl">
      <Image
        src={media.url}
        alt=""
        width={media.width ?? 400}
        height={media.height ?? 400}
        className="h-auto max-h-80 w-full object-cover"
      />
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete photo"
          className="bg-background/80 text-foreground absolute top-1.5 right-1.5 rounded-full p-1 opacity-0 shadow transition-opacity group-hover/media:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
