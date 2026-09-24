import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getProfileByUserId } from "@/lib/data/profiles";
import { ProfileEditForm } from "@/components/settings/profile-edit-form";

export const metadata = { title: "Edit profile / OwnReach" };

export default async function ProfileSettingsPage() {
  const session = await verifySession();
  if (!session) redirect("/login?next=/settings/profile");

  const profile = await getProfileByUserId(session.userId);
  if (!profile) redirect("/login");

  return <ProfileEditForm profile={profile} />;
}
