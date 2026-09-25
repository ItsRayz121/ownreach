"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 30);
}

export function CreateCommunityDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit() {
    if (!name.trim() || !slug.trim()) return;
    startTransition(async () => {
      try {
        const community = await createCommunity({ name: name.trim(), slug: slug.trim(), description: description.trim() || undefined, visibility });
        setOpen(false);
        router.push(`/communities/${community.slug}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't create that community.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" />
        Create community
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a community</DialogTitle>
          <DialogDescription>Bring people together around a topic — add channels once it&apos;s set up.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
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
              placeholder="What's this community about?"
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
