import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Reset password / OwnReach", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            OwnReach
          </Link>
          <p className="text-muted-foreground mt-2 text-sm text-balance">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <ForgotPasswordForm />

        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link href="/login" className="hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
