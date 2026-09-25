"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePassword } from "@/lib/actions/auth";

type Status = "idle" | "submitting" | "error" | "success";

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setStatus("error");
      setError("Those passwords don't match.");
      return;
    }

    setStatus("submitting");
    const result = await changePassword({ currentPassword, newPassword });
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setStatus("success");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border px-4 py-3">
      <p className="text-sm font-medium">Change password</p>
      <Input
        type="password"
        required
        placeholder="Current password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        disabled={status === "submitting"}
      />
      <Input
        type="password"
        required
        minLength={8}
        placeholder="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        disabled={status === "submitting"}
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
        {status === "submitting" ? "Saving…" : "Change password"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {status === "success" && <p className="text-sm text-green-600 dark:text-green-500">Password updated.</p>}
    </form>
  );
}
