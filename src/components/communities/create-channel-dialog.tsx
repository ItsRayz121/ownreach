"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createChannel } from "@/lib/actions/communities";

export function CreateChannelDialog({ communityId, communitySlug }: { communityId: string; communitySlug: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const channel = await createChannel(communityId, { name: name.trim(), description: description.trim() || undefined });
        setOpen(false);
        setName("");
        setDescription("");
        router.push(`/communities/${communitySlug}/${channel.id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't create that channel.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="text-muted-foreground hover:bg-accent/60 hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm"
          />
        }
      >
        <Plus className="size-4" />
        Add channel
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>Channels are where members talk. Every member of this community can read and post.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="channel-name">Name</Label>
            <Input id="channel-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="general" maxLength={40} />
          </div>
          <div>
            <Label htmlFor="channel-description">Description (optional)</Label>
            <Textarea
              id="channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder="What's this channel for?"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
