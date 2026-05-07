import Link from "next/link"
import {
  Apple,
  Dumbbell,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  Zap,
  PersonStanding,
  type LucideIcon,
} from "lucide-react"

import { Logo } from "@/components/brand/logo"
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
 * see a single "Vezi contul" CTA in the header instead of the auth buttons.
 */
export default async function MarketingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
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

      <main>
        <Hero />
        <Services />
        <Trainers />
        <WhyUs />
        <Contact />
      </main>

      <footer className="mt-12 border-t bg-foreground text-background">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:grid-cols-3">
          <div className="space-y-2">
            <p className="font-semibold tracking-tight">{BUSINESS.name}</p>
            <p className="text-xs opacity-70">{BUSINESS.tagline}</p>
          </div>
          <div className="text-sm opacity-90">
            <p>{BUSINESS.address}</p>
            <p>{BUSINESS.phone}</p>
            <p>{BUSINESS.email}</p>
          </div>
          <div className="text-sm opacity-90">
            <Link href="/sign-in" className="block hover:underline">
              Membri
            </Link>
            <Link href="/sign-up" className="block hover:underline">
              Înregistrare
            </Link>
            <a
              href={BUSINESS.instagram}
              target="_blank"
              rel="noreferrer"
              className="block hover:underline"
            >
              {BUSINESS.instagramHandle}
            </a>
          </div>
        </div>
        <div className="border-t border-background/10 px-4 py-3 text-center text-xs opacity-60">
          © {new Date().getFullYear()} {BUSINESS.name}
        </div>
      </footer>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-foreground text-background">
      {/* Diagonal red accent stripe */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 -skew-x-12 bg-primary/20 sm:block"
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:py-28">
        <div className="max-w-2xl space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
            <Sparkles className="size-3.5" />
            Personal training · Oradea
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Antrenamente care{" "}
            <span className="text-primary">transformă</span>
            <br />
            corpul și mintea.
          </h1>
          <p className="max-w-xl text-base text-background/80 sm:text-lg">
            Sesiuni 1-la-1 sau în grupuri mici, plan nutrițional personalizat,
            urmărirea progresului — totul într-un singur loc, alături de
            antrenori dedicați.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
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
        </div>
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
    desc: "Antrenamente 1-la-1, adaptate obiectivelor și nivelului tău.",
  },
  {
    icon: Users,
    title: "Antrenamente în grup",
    desc: "Sesiuni de grup mic, motivante și energizante.",
  },
  {
    icon: Apple,
    title: "Nutriție & dietă",
    desc: "Planuri alimentare personalizate, livrate digital.",
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
  {
    icon: Timer,
    title: "Flexibilitate program",
    desc: "Rezervări pe aplicație, anulare cu 3 ore înainte.",
  },
]

function Services() {
  return (
    <section className="mx-auto max-w-5xl space-y-8 px-4 py-16 sm:py-20">
      <div className="space-y-2 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Ce oferim
        </p>
        <h2 className="text-3xl font-semibold tracking-tight">Servicii</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => {
          const Icon = s.icon
          return (
            <Card
              key={s.title}
              className="transition-colors hover:border-primary/40"
            >
              <CardHeader className="space-y-3">
                <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
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

const TRAINERS: Array<{ initials: string; name: string; speciality: string }> = [
  {
    initials: "E",
    name: "Eugen",
    speciality: "Antrenor pentru bărbați · forță și hipertrofie",
  },
  {
    initials: "M",
    name: "Marina",
    speciality: "Antrenor pentru femei · transformare corporală",
  },
  {
    initials: "A",
    name: "Ana",
    speciality: "Antrenor pentru femei · cardio și flexibilitate",
  },
]

function Trainers() {
  return (
    <section className="bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl space-y-8 px-4">
        <div className="space-y-2 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            Echipa
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">Antrenorii</h2>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            Trei antrenori dedicați, fiecare cu specializarea lui. Te
            repartizăm în funcție de obiective și disponibilitate.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {TRAINERS.map((tr) => (
            <Card key={tr.name} className="text-center">
              <CardHeader className="items-center space-y-3">
                <div className="inline-flex size-16 items-center justify-center rounded-full bg-foreground text-2xl font-bold text-background ring-2 ring-primary/40 ring-offset-2">
                  {tr.initials}
                </div>
                <CardTitle>{tr.name}</CardTitle>
                <CardDescription className="text-xs">
                  {tr.speciality}
                </CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

const WHY = [
  {
    icon: ShieldCheck,
    title: "Plan personalizat",
    desc: "Fiecare antrenament e gândit pentru obiectivul tău — nu e program generic.",
  },
  {
    icon: Timer,
    title: "Rezervări simple",
    desc: "Aplicație rapidă, rezervări într-un click, notificări automate.",
  },
  {
    icon: Apple,
    title: "Nutriție inclusă",
    desc: "Plan alimentar livrat digital, ajustat lunar de antrenor.",
  },
]

function WhyUs() {
  return (
    <section className="mx-auto max-w-5xl space-y-8 px-4 py-16 sm:py-20">
      <div className="space-y-2 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          De ce noi
        </p>
        <h2 className="text-3xl font-semibold tracking-tight">
          Mai mult decât o sală de fitness
        </h2>
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        {WHY.map((w) => {
          const Icon = w.icon
          return (
            <div key={w.title} className="space-y-2 text-center">
              <Icon className="mx-auto size-6 text-primary" />
              <p className="font-semibold">{w.title}</p>
              <p className="text-sm text-muted-foreground">{w.desc}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Contact() {
  return (
    <section className="bg-foreground py-16 text-background sm:py-20">
      <div className="mx-auto max-w-5xl space-y-8 px-4">
        <div className="space-y-2 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            Vino la noi
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">Contact</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href={`tel:${BUSINESS.phoneIntl}`}
            className="flex items-center gap-3 rounded-lg border border-background/10 bg-background/5 p-3 transition-colors hover:border-primary/50"
          >
            <Phone className="size-5 text-primary" />
            <div>
              <p className="text-xs text-background/60">Telefon</p>
              <p className="font-medium">{BUSINESS.phone}</p>
            </div>
          </a>
          <a
            href={`mailto:${BUSINESS.email}`}
            className="flex items-center gap-3 rounded-lg border border-background/10 bg-background/5 p-3 transition-colors hover:border-primary/50"
          >
            <Mail className="size-5 text-primary" />
            <div>
              <p className="text-xs text-background/60">Email</p>
              <p className="font-medium">{BUSINESS.email}</p>
            </div>
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${BUSINESS.mapQuery}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg border border-background/10 bg-background/5 p-3 transition-colors hover:border-primary/50"
          >
            <MapPin className="size-5 text-primary" />
            <div>
              <p className="text-xs text-background/60">Adresă</p>
              <p className="font-medium">{BUSINESS.address}</p>
            </div>
          </a>
          <a
            href={BUSINESS.instagram}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg border border-background/10 bg-background/5 p-3 transition-colors hover:border-primary/50"
          >
            <InstagramGlyph className="size-5 text-primary" />
            <div>
              <p className="text-xs text-background/60">Instagram</p>
              <p className="font-medium">{BUSINESS.instagramHandle}</p>
            </div>
          </a>
        </div>
        <div className="text-center">
          <Link
            href="/sign-up"
            className={buttonVariants({ variant: "default", size: "lg" })}
          >
            Începe acum
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * Inline Instagram glyph — `lucide-react@1` removed brand icons over
 * trademark concerns. We use the same stroke style as the lucide icons so
 * it sits naturally beside them.
 */
function InstagramGlyph(props: React.SVGProps<SVGSVGElement>) {
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
