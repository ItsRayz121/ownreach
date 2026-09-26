"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCommunity } from "@/lib/actions/communities";
import { uploadImage } from "@/lib/upload-client";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 30);
}

export function CreateCommunityDialog({ defaultKind = "group" }: { defaultKind?: "group" | "channel" }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [kind, setKind] = useState<"group" | "channel">(defaultKind);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarPick(file?: File) {
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const result = await uploadImage(file, "community-avatars");
      setAvatarUrl(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  function handleSubmit() {
    if (!name.trim() || !slug.trim()) return;
    startTransition(async () => {
      try {
        const community = await createCommunity({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          visibility,
          kind,
          avatarUrl: avatarUrl ?? undefined,
        });
        setOpen(false);
        router.push(`/communities/${community.slug}/${community.defaultChannelId}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't create that community.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" />
        {defaultKind === "channel" ? "Create channel" : "Create group"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "channel" ? "Create a channel" : "Create a group"}</DialogTitle>
          <DialogDescription>Start chatting right away — no extra setup steps.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="bg-muted relative flex size-16 items-center justify-center overflow-hidden rounded-full border"
                aria-label="Pick an avatar"
              >
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="" fill className="object-cover" />
                ) : (
                  <Camera className="text-muted-foreground size-5" />
                )}
                {isUploadingAvatar && (
                  <span className="bg-background/70 absolute inset-0 flex items-center justify-center">
                    <Loader2 className="size-4 animate-spin" />
                  </span>
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarPick(e.target.files?.[0])}
              />
            </div>
            <p className="text-muted-foreground text-xs">Optional avatar for the {kind === "channel" ? "channel" : "group"}.</p>
          </div>

          <div>
            <Label htmlFor="community-name">Name</Label>
            <Input
              id="community-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) setSlug(slugify(e.target.value));
              }}
              placeholder="Indie Hackers"
              maxLength={60}
            />
          </div>
          <div>
            <Label htmlFor="community-slug">Handle</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-sm">/communities/</span>
              <Input
                id="community-slug"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="indie-hackers"
                maxLength={30}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="community-description">Description (optional)</Label>
            <Textarea
              id="community-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="What's this about?"
              rows={2}
            />
          </div>
          <div>
            <Label>Type</Label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setKind("group")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  kind === "group" ? "border-primary bg-accent" : "hover:bg-accent/50"
                )}
              >
                <p className="font-medium">Group</p>
                <p className="text-muted-foreground text-xs">Any member can post</p>
              </button>
              <button
                type="button"
                onClick={() => setKind("channel")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  kind === "channel" ? "border-primary bg-accent" : "hover:bg-accent/50"
                )}
              >
                <p className="font-medium">Channel</p>
                <p className="text-muted-foreground text-xs">Only you and admins can post</p>
              </button>
            </div>
          </div>
          <div>
            <Label>Visibility</Label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  visibility === "public" ? "border-primary bg-accent" : "hover:bg-accent/50"
                )}
              >
                <p className="font-medium">Public</p>
                <p className="text-muted-foreground text-xs">Listed in Discover, anyone can join</p>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  visibility === "private" ? "border-primary bg-accent" : "hover:bg-accent/50"
                )}
              >
                <p className="font-medium">Private</p>
                <p className="text-muted-foreground text-xs">Hidden from Discover, joinable by link</p>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim() || !slug.trim()}>
            {isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
