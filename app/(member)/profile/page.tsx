import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth/get-user"

import { ProfileForm } from "./profile-form"
import { ChangePasswordForm } from "./change-password-form"
import { FreezeSection } from "./freeze-section"
import { GdprViewer } from "./gdpr-viewer"

export default async function ProfilePage() {
  const { profile } = await requireUser()
  const t = await getTranslations("profilePage")

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("myProfile")}
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("personalDetails")}</CardTitle>
          <CardDescription>{t("personalDetailsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultName={profile.full_name ?? ""}
            defaultPhone={profile.phone ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("changePassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <FreezeSection userId={profile.id} />

      <GdprViewer
        consentedAt={profile.gdpr_consented_at}
        consentedVersion={profile.gdpr_version}
      />
    </div>
  )
}
