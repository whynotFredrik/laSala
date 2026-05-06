import Link from "next/link"
import {
  Apple,
  Dumbbell,
  Mail,
  MapPin,
  Phone,
  Users,
  Zap,
  PersonStanding,
  type LucideIcon,
} from "lucide-react"

/**
 * Inline Instagram glyph — `lucide-react@1` removed brand icons over
 * trademark concerns. We use the same outline-style stroke as the lucide
 * icons so it sits naturally beside them.
 */
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BUSINESS } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"

/**
 * Public landing page. Public — middleware doesn't gate `/`. Logged-in users
 * see a single "Vezi contul" CTA at the top instead of the login button.
 */
export default async function MarketingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <p className="font-semibold tracking-tight">{BUSINESS.name}</p>
          {user ? (
            <Link
              href="/home"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              Contul tău
            </Link>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Autentificare
              </Link>
              <Link
                href="/sign-up"
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                Înregistrare
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-4 py-12">
        <Hero />
        <Services />
        <Contact />
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {BUSINESS.name} ·{" "}
          <Link href="/sign-in" className="hover:underline">
            Membri
          </Link>
        </div>
      </footer>
    </div>
  )
}

function Hero() {
  return (
    <section className="space-y-6 py-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {BUSINESS.name}
      </h1>
      <p className="mx-auto max-w-xl text-lg text-muted-foreground">
        {BUSINESS.tagline}. Antrenamente personalizate, sesiuni în grup și
        nutriție — într-un singur loc, în Oradea.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href="/sign-up"
          className={buttonVariants({ variant: "default", size: "lg" })}
        >
          Începe acum
        </Link>
        <Link
          href={`https://www.google.com/maps/search/?api=1&query=${BUSINESS.mapQuery}`}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <MapPin />
          Vezi pe hartă
        </Link>
      </div>
    </section>
  )
}

const SERVICES: Array<{
  icon: LucideIcon
  title: string
  desc: string
}> = [
  {
    icon: Dumbbell,
    title: "Personal Training",
    desc: "Antrenamente 1-la-1 personalizate pentru obiectivele tale.",
  },
  {
    icon: Users,
    title: "Antrenamente în grup",
    desc: "Sesiuni de grup motivante și energizante.",
  },
  {
    icon: Apple,
    title: "Nutriție & dietă",
    desc: "Planuri alimentare adaptate stilului tău de viață.",
  },
  {
    icon: PersonStanding,
    title: "Transformare corporală",
    desc: "Programe complete pentru slăbit sau masă musculară.",
  },
  {
    icon: Zap,
    title: "HIIT & cardio",
    desc: "Antrenamente intense pentru arderea grăsimilor.",
  },
]

function Services() {
  return (
    <section className="space-y-6">
      <h2 className="text-center text-2xl font-semibold tracking-tight">
        Servicii
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.title}>
              <CardHeader className="space-y-2">
                <Icon className="size-6 text-primary" />
                <CardTitle className="text-base">{s.title}</CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          )
        })}
      </div>
    </section>
  )
}

function Contact() {
  return (
    <section className="space-y-6">
      <h2 className="text-center text-2xl font-semibold tracking-tight">
        Contact
      </h2>
      <Card>
        <CardContent className="grid gap-4 py-4 sm:grid-cols-2">
          <a
            href={`tel:${BUSINESS.phoneIntl}`}
            className="flex items-center gap-3 rounded p-2 hover:bg-muted"
          >
            <Phone className="size-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Telefon</p>
              <p className="font-medium">{BUSINESS.phone}</p>
            </div>
          </a>
          <a
            href={`mailto:${BUSINESS.email}`}
            className="flex items-center gap-3 rounded p-2 hover:bg-muted"
          >
            <Mail className="size-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium">{BUSINESS.email}</p>
            </div>
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${BUSINESS.mapQuery}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded p-2 hover:bg-muted"
          >
            <MapPin className="size-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Adresă</p>
              <p className="font-medium">{BUSINESS.address}</p>
            </div>
          </a>
          <a
            href={BUSINESS.instagram}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded p-2 hover:bg-muted"
          >
            <InstagramIcon className="size-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Instagram</p>
              <p className="font-medium">{BUSINESS.instagramHandle}</p>
            </div>
          </a>
        </CardContent>
      </Card>
    </section>
  )
}
