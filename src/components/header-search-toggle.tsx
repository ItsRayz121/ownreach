"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HeaderSearchToggleProps {
  action: string;
  name: string;
  placeholder: string;
  defaultValue?: string;
}

export function HeaderSearchToggle({ action, name, placeholder, defaultValue }: HeaderSearchToggleProps) {
  const [open, setOpen] = useState(Boolean(defaultValue));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground hover:bg-accent/60 shrink-0 rounded-full p-1.5 transition-colors"
        aria-label="Search"
      >
        <Search className="size-4.5" />
      </button>
    );
  }

  return (
    <form action={action} className="relative flex-1">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input name={name} defaultValue={defaultValue} placeholder={placeholder} autoFocus className="pr-9 pl-9" />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
        aria-label="Close search"
      >
        <X className="size-4" />
      </button>
    </form>
  );
}
