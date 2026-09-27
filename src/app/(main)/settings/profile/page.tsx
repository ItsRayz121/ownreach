import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { getProfileByUserId, getSocialLinks } from "@/lib/data/profiles";
import { getLinkedProviders } from "@/lib/auth/accounts";
import { ProfileEditForm } from "@/components/settings/profile-edit-form";
import { SocialLinksEditor } from "@/components/settings/social-links-editor";
import { GoogleButton } from "@/components/auth/google-button";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { WalletConnectButton } from "@/components/auth/wallet-connect-button";
import { EmailLoginForm } from "@/components/auth/email-login-form";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata = { title: "Edit profile / OwnReach" };

const PROVIDER_LABELS = {
  google: "Google",
  telegram: "Telegram",
  wallet: "Wallet",
  email: "Email",
  password: "Password",
} as const;

export default async function ProfileSettingsPage() {
  const session = await verifySession();
  if (!session) redirect("/login?next=/settings/profile");

  const [profile, socialLinks, linked] = await Promise.all([
    getProfileByUserId(session.userId),
    getSocialLinks(session.userId),
    getLinkedProviders(session.userId),
  ]);
  if (!profile) redirect("/login");

  const linkedProviders = new Set(linked.map((a) => a.provider));

  return (
    <div>
      <ProfileEditForm profile={profile} />

      <div className="border-t px-4 py-6">
        <SocialLinksEditor initialLinks={socialLinks} />
      </div>

      <div className="border-t px-4 py-6">
        <h2 className="text-sm font-semibold">Connected accounts</h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">
          Link multiple sign-in methods to the same account — your identity, followers, and posts stay put even if
          you lose access to one provider.
        </p>

        {linked.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {linked.map((account) => (
              <li key={account.id} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
                <span>{PROVIDER_LABELS[account.provider]}</span>
                <span className="text-primary flex items-center gap-1.5">
                  <Check className="size-4" />
                  Connected
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3">
          {!linkedProviders.has("google") && <GoogleButton link label="Connect Google" />}
          {!linkedProviders.has("telegram") && <TelegramLoginButton link />}
          {!linkedProviders.has("wallet") && <WalletConnectButton link />}
          {!linkedProviders.has("email") && <EmailLoginForm link />}
          {linkedProviders.has("password") ? <ChangePasswordForm /> : <SetPasswordForm />}
        </div>
      </div>
    </div>
  );
}
