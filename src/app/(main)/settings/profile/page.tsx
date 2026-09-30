import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getProfileByUserId, getSocialLinks } from "@/lib/data/profiles";
import { ProfileEditForm } from "@/components/settings/profile-edit-form";
import { SocialLinksEditor } from "@/components/settings/social-links-editor";

export const metadata = { title: "Edit profile / OwnReach" };

export default async function ProfileSettingsPage() {
  const session = await verifySession();
  if (!session) redirect("/login?next=/settings/profile");

  const [profile, socialLinks] = await Promise.all([
    getProfileByUserId(session.userId),
    getSocialLinks(session.userId),
  ]);
  if (!profile) redirect("/login");

  return (
    <div>
      <h1 className="border-b px-4 py-4 text-xl font-semibold">Edit profile</h1>
      <ProfileEditForm profile={profile} />

      <div className="border-t px-4 py-6">
        <SocialLinksEditor initialLinks={socialLinks} />
      </div>
    </div>
  );
}
