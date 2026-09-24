"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Bold, Italic, Underline, Strikethrough, Code, Link2, ImagePlus, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { createPost } from "@/lib/actions/posts";
import { uploadImage } from "@/lib/upload-client";
import { useSelectionFormatting } from "@/lib/hooks/use-selection-formatting";
import { useMagicPencilPaste } from "@/lib/hooks/use-magic-pencil-paste";
import { SelectionToolbar } from "@/components/post/selection-toolbar";
import { toast } from "sonner";

const MAX_LENGTH = 2000;

interface PostComposerProps {
  displayName: string;
  avatarUrl?: string | null;
  onPosted?: () => void;
  autoFocus?: boolean;
}

export function PostComposer({ displayName, avatarUrl, onPosted, autoFocus }: PostComposerProps) {
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<{ url: string; width: number; height: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    textareaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    textareaRef.current?.focus();
    // Only ever run once, for the initial "Create" nav click — not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { anchor, close: closeToolbar, wrapSelection, clearFormatting } = useSelectionFormatting(textareaRef, setBody);
  const magicPencil = useMagicPencilPaste(textareaRef, setBody);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported for now.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Images must be under 8MB.");
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadImage(file, "posts");
      setMedia(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleSubmit() {
    if (!body.trim() && !media) return;
    startTransition(async () => {
      try {
        await createPost({
          body,
          mediaUrl: media?.url,
          mediaWidth: media?.width,
          mediaHeight: media?.height,
        });
        setBody("");
        setMedia(null);
        onPosted?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't publish your post.");
      }
    });
  }

  const remaining = MAX_LENGTH - body.length;

  return (
    <div className="flex gap-3 border-b px-4 py-4">
      <UserAvatar src={avatarUrl} name={displayName} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            magicPencil.notifyEdited();
            setBody(e.target.value.slice(0, MAX_LENGTH));
          }}
          onPaste={magicPencil.handlePaste}
          placeholder="What's happening in your community?"
          rows={3}
          className="min-h-20 resize-none border-none px-0 text-[16px] shadow-none focus-visible:ring-0"
        />
        <SelectionToolbar anchor={anchor} onClose={closeToolbar} wrapSelection={wrapSelection} clearFormatting={clearFormatting} />

        {media && (
          <div className="relative mt-2 w-fit overflow-hidden rounded-xl border">
            <Image src={media.url} alt="" width={media.width} height={media.height} className="max-h-64 w-auto" />
            <button
              type="button"
              onClick={() => setMedia(null)}
              className="bg-background/90 absolute top-2 right-2 rounded-full p-1 shadow"
              aria-label="Remove image"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <div className="text-muted-foreground flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={() => wrapSelection("**")} aria-label="Bold">
              <Bold className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => wrapSelection("*")} aria-label="Italic">
              <Italic className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => wrapSelection("__")}
              aria-label="Underline"
            >
              <Underline className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => wrapSelection("~~")}
              aria-label="Strikethrough"
            >
              <Strikethrough className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => wrapSelection("`")} aria-label="Code">
              <Code className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => wrapSelection("[", "](https://)")}
              aria-label="Link"
            >
              <Link2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || Boolean(media)}
              aria-label="Add image"
            >
              {isUploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            {magicPencil.active && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={magicPencil.apply}
                aria-label="Magic pencil — restore original formatting"
                title="Magic pencil — restore original formatting"
              >
                <Sparkles className="size-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {body.length > MAX_LENGTH - 100 && (
              <span className={remaining < 0 ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                {remaining}
              </span>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isPending || isUploading || (!body.trim() && !media) || remaining < 0}
            >
              {isPending ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
