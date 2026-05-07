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
import { MealPlanCard } from "./meal-plan-card"

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
        <CardContent className="space-y-4">
          <ProfileForm
            defaultName={profile.full_name ?? ""}
            defaultPhone={profile.phone ?? ""}
          />
          {profile.trainer ? (
            <p className="rounded border bg-muted/40 p-2 text-sm">
              <span className="text-muted-foreground">{t("trainer")}: </span>
              <span className="font-medium">{profile.trainer}</span>
            </p>
          ) : null}
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

      <MealPlanCard userId={profile.id} />

      <FreezeSection userId={profile.id} />

      <GdprViewer
        consentedAt={profile.gdpr_consented_at}
        consentedVersion={profile.gdpr_version}
      />
    </div>
  )
}
