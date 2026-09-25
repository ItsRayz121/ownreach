"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/actions/auth";

type Status = "idle" | "sending" | "sent" | "error";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const result = await requestPasswordReset({ email });
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setStatus("sent");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  };

  if (status === "sent") {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-center text-sm">
        If an account exists for <span className="text-foreground font-medium">{email}</span>, we&apos;ve sent a
        reset link. It expires in 30 minutes.
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
        autoFocus
      />
      <Button type="submit" variant="outline" size="lg" className="w-full gap-3" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send reset link"}
      </Button>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
    </form>
  );
}
