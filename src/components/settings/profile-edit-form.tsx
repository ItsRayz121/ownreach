"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { updateProfile, updateProfileImage } from "@/lib/actions/profile";
import { uploadImage } from "@/lib/upload-client";
import { toast } from "sonner";

interface ProfileEditFormProps {
  profile: {
    displayName: string;
    bio: string | null;
    location: string | null;
    website: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
  };
}

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(profile.coverUrl);
  const [uploadingKind, setUploadingKind] = useState<"avatar" | "cover" | null>(null);
  const [isPending, startTransition] = useTransition();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function handleImagePick(kind: "avatar" | "cover", file?: File) {
    if (!file) return;
    setUploadingKind(kind);
    try {
      const result = await uploadImage(file, kind === "avatar" ? "avatars" : "covers");
      await updateProfileImage(kind, result.url);
      if (kind === "avatar") {
        setAvatarUrl(result.url);
      } else {
        setCoverUrl(result.url);
      }
      toast.success(`${kind === "avatar" ? "Avatar" : "Cover photo"} updated.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadingKind(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateProfile({ displayName, bio, location, website });
        toast.success("Profile updated.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't save your profile.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-6">
      <div className="mb-6">
        <div className="bg-muted relative h-32 overflow-hidden rounded-xl sm:h-40">
          {coverUrl && <Image src={coverUrl} alt="" fill className="object-cover" />}
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="bg-background/80 absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow"
          >
            {uploadingKind === "cover" ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            Cover
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImagePick("cover", e.target.files?.[0])}
          />
        </div>

        <div className="relative -mt-10 ml-4 w-fit">
          <UserAvatar src={avatarUrl} name={displayName} className="border-background size-20 border-4" />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="bg-background absolute right-0 bottom-0 rounded-full border p-1.5 shadow"
            aria-label="Change avatar"
          >
            {uploadingKind === "avatar" ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImagePick("avatar", e.target.files?.[0])}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={60} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            maxLength={200}
            className="mt-1.5"
          />
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="mt-6 w-full sm:w-auto">
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
