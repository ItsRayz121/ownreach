"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "idle" | "sending" | "sent" | "error";

interface EmailLoginFormProps {
  link?: boolean;
}

export function EmailLoginForm({ link }: EmailLoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/auth/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, link }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the sign-in email.");
      setStatus("sent");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Couldn't send the sign-in email.");
    }
  };

  if (status === "sent") {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-center text-sm">
        Check <span className="text-foreground font-medium">{email}</span> for a sign-in link. It expires in 15
        minutes.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "sending"}
      />
      <Button type="submit" variant="outline" size="lg" className="w-full gap-3" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : link ? "Connect email" : "Continue with email"}
      </Button>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
    </form>
  );
}
