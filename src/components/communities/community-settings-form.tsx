"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { updateCommunity, deleteCommunity } from "@/lib/actions/communities";
import { uploadImage } from "@/lib/upload-client";
import type { Community } from "@/db/schema";

export function CommunitySettingsForm({ community, canDelete }: { community: Community; canDelete: boolean }) {
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? "");
  const [visibility, setVisibility] = useState(community.visibility);
  const [avatarUrl, setAvatarUrl] = useState(community.avatarUrl);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarPick(file?: File) {
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const result = await uploadImage(file, "community-avatars");
      await updateCommunity(community.id, { avatarUrl: result.url });
      setAvatarUrl(result.url);
      toast.success("Avatar updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateCommunity(community.id, { name: name.trim(), description: description.trim() || undefined, visibility });
        toast.success("Saved.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't save changes.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${community.name}"? This can't be undone.`)) return;
    startDelete(async () => {
      try {
        await deleteCommunity(community.id);
        router.push("/communities");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't delete this community.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="bg-muted relative flex size-16 items-center justify-center overflow-hidden rounded-full border"
            aria-label="Change avatar"
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
        <p className="text-muted-foreground text-xs">Tap to change the avatar.</p>
      </div>
      <div>
        <Label htmlFor="settings-name">Name</Label>
        <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </div>
      <div>
        <Label htmlFor="settings-description">Description</Label>
        <Textarea
          id="settings-description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          rows={2}
        />
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
      <Button onClick={handleSave} disabled={isPending || !name.trim()} className="self-start">
        {isPending ? "Saving…" : "Save changes"}
      </Button>

      {canDelete && (
        <div className="mt-4 border-t pt-4">
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete community"}
          </Button>
        </div>
      )}
    </div>
  );
}
