import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Set a new password / OwnReach", robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            OwnReach
          </Link>
          <p className="text-muted-foreground mt-2 text-sm text-balance">Choose a new password.</p>
        </div>

        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-center text-sm">
            That reset link looks broken. Request a new one from the{" "}
            <Link href="/login/forgot-password" className="text-foreground hover:underline">
              forgot password
            </Link>{" "}
            page.
          </p>
        )}
      </div>
    </div>
  );
}
