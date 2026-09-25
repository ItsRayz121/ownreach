"use client";

import { useState, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/lib/actions/auth";

type Status = "idle" | "submitting" | "error";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setStatus("error");
      setError("Those passwords don't match.");
      return;
    }

    setStatus("submitting");
    try {
      const result = await resetPassword({ token, password });
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
      }
      // On success the action itself redirects, so there's nothing else to do here.
    } catch (e) {
      // A successful reset rejects this promise with Next's internal redirect
      // signal — let it propagate so RedirectBoundary handles the navigation.
      unstable_rethrow(e);
      setStatus("error");
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Input
        type="password"
        required
        minLength={8}
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={status === "submitting"}
        autoFocus
      />
      <Input
        type="password"
        required
        minLength={8}
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={status === "submitting"}
      />
      <Button type="submit" variant="outline" size="lg" className="w-full gap-3" disabled={status === "submitting"}>
        {status === "submitting" ? "Please wait…" : "Reset password"}
      </Button>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
    </form>
  );
}
