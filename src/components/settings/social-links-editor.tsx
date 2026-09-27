"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialIcon } from "@/components/social-icon";
import { addSocialLink, deleteSocialLink } from "@/lib/actions/profile";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS, type SocialPlatform } from "@/lib/social-platforms";
import { toast } from "sonner";

interface SocialLink {
  id: string;
  platform: SocialPlatform;
  label: string | null;
  url: string;
}

export function SocialLinksEditor({ initialLinks }: { initialLinks: SocialLink[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [isAdding, setIsAdding] = useState(false);
  const [platform, setPlatform] = useState<SocialPlatform>("youtube");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdd() {
    if (!url.trim()) return;
    startTransition(async () => {
      try {
        const link = await addSocialLink({ platform, label: platform === "other" ? label : undefined, url });
        setLinks((prev) => [...prev, link]);
        setUrl("");
        setLabel("");
        setIsAdding(false);
        toast.success("Social link added.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't add that link.");
      }
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteSocialLink(id);
        setLinks((prev) => prev.filter((l) => l.id !== id));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't remove that link.");
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <div>
      <Label>Social media</Label>
      <p className="text-muted-foreground mt-1 text-xs">
        Add links to your other profiles. Only the platform icon shows up on your profile.
      </p>

      {links.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
              <span className="flex min-w-0 items-center gap-2.5">
                <SocialIcon platform={link.platform} className="size-4 shrink-0" />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="text-sm font-medium">
                    {link.platform === "other" ? link.label : SOCIAL_PLATFORM_LABELS[link.platform]}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">{link.url}</span>
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(link.id)}
                disabled={isPending && deletingId === link.id}
                aria-label="Remove link"
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex gap-2">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {platform === "other" && (
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Platform name"
                maxLength={30}
                className="flex-1"
              />
            )}
          </div>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" maxLength={200} />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAdd} disabled={isPending || !url.trim()}>
              {isPending ? "Adding…" : "Add link"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        links.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="size-3.5" />
            Add social media
          </Button>
        )
      )}
    </div>
  );
}
