"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

const MAX_OPTIONS = 10;

interface PollComposerDialogProps<TMessage> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (question: string, options: string[], allowMultiple: boolean) => Promise<TMessage>;
  onCreated: (message: TMessage) => void;
}

// Opened from the composer's + menu, which owns the `open` state.
export function PollComposerDialog<TMessage>({ open, onOpenChange, onCreate, onCreated }: PollComposerDialogProps<TMessage>) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setQuestion("");
    setOptions(["", ""]);
    setAllowMultiple(false);
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    setOptions((prev) => (prev.length < MAX_OPTIONS ? [...prev, ""] : prev));
  }

  function removeOption(index: number) {
    setOptions((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  }

  const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 0 && trimmedOptions.length >= 2;

  function handleSubmit() {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const message = await onCreate(question.trim(), trimmedOptions, allowMultiple);
        onCreated(message);
        onOpenChange(false);
        reset();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't create that poll.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a poll</DialogTitle>
          <DialogDescription>Ask a question and let people vote right in the chat.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="poll-question">Question</Label>
            <Input
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 300))}
              placeholder="What should we do this weekend?"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Options</Label>
            {options.map((option, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input value={option} onChange={(e) => updateOption(i, e.target.value.slice(0, 100))} placeholder={`Option ${i + 1}`} />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    aria-label="Remove option"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                onClick={addOption}
                className="text-primary flex items-center gap-1 self-start text-xs font-medium hover:underline"
              >
                <Plus className="size-3.5" /> Add option
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} className="size-4" />
            Allow multiple answers
          </label>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
            {isPending ? "Creating…" : "Create poll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
