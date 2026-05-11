/**
 * Typed email templates. Each template returns the rendered subject + heading
 * + html-safe body fragment. The send wrapper passes them through
 * `renderEmailLayout` to add the shared chrome.
 */

import { BUSINESS, EMAIL_SENDERS } from "@/lib/constants"

import { escape } from "./layout"

type SenderKey = keyof typeof EMAIL_SENDERS

type Rendered = {
  subject: string
  heading: string
  body: string
  sender: SenderKey
}

export type TemplatePropsMap = {
  bookingConfirmation: {
    name: string
    className: string
    date: string
    time: string
  }
  bookingCancellation: {
    name: string
    className: string
    date: string
    time: string
  }
  bookingReschedule: {
    name: string
    className: string
    newDate: string
    newTime: string
  }
  bookingReminder: {
    name: string
    className: string
    date: string
    time: string
    days: 1 | 3
  }
  planRequestReceived: {
    name: string
    planName: string
    price: number
  }
  planApproved: {
    name: string
    planName: string
    sessionsTotal: number
    endDate: string
  }
  planRejected: {
    name: string
    planName: string
    reason: string
  }
  expirationWarning: {
    name: string
    planName: string
    days: number
    endDate: string
  }
  lowSessionsWarning: {
    name: string
    planName: string
    remaining: number
  }
  adminPlanRequestNew: {
    userName: string
    userEmail: string
    planName: string
    price: number
    paymentMethod: string
  }
}

export type TemplateId = keyof TemplatePropsMap

export const TEMPLATES: {
  [K in TemplateId]: (props: TemplatePropsMap[K]) => Rendered
} = {
  bookingConfirmation: (p) => ({
    subject: `Rezervare confirmată — ${p.date} ora ${p.time}`,
    heading: "Rezervarea ta este confirmată!",
    body: `
      <p>Salut, ${escape(p.name)}!</p>
      <p><strong>Curs:</strong> ${escape(p.className)}</p>
      <p><strong>Data:</strong> ${escape(p.date)}</p>
      <p><strong>Ora:</strong> ${escape(p.time)}</p>
      <p>Te așteptăm la studio. Dacă nu mai poți ajunge, anulează cu cel puțin 3 ore înainte.</p>
      <p>Adresa: ${escape(BUSINESS.address)}</p>
    `,
    sender: "bookings",
  }),

  bookingCancellation: (p) => ({
    subject: `Rezervare anulată — ${p.date} ora ${p.time}`,
    heading: "Rezervarea ta a fost anulată",
    body: `
      <p>Salut, ${escape(p.name)}!</p>
      <p>Ai anulat rezervarea pentru <strong>${escape(p.className)}</strong>, ${escape(p.date)} la ora ${escape(p.time)}.</p>
      <p>Sesiunea a fost reactivată în planul tău.</p>
    `,
    sender: "bookings",
  }),

  bookingReschedule: (p) => ({
    subject: "Rezervare reprogramată",
    heading: "Rezervarea ta a fost reprogramată",
    body: `
      <p>Salut, ${escape(p.name)}!</p>
      <p>Noua ta rezervare:</p>
      <p><strong>Curs:</strong> ${escape(p.className)}</p>
      <p><strong>Data:</strong> ${escape(p.newDate)} la ora ${escape(p.newTime)}</p>
    `,
    sender: "bookings",
  }),

  bookingReminder: (p) => ({
    subject:
      p.days === 1
        ? "Mâine este ultima ta oră din abonament"
        : `În ${p.days} zile este ultima ta oră din abonament`,
    heading: "Ultima ta oră din abonamentul curent",
    body: `
      <p>Salut, ${escape(p.name)}!</p>
      <p>Ai folosit toate sesiunile din abonamentul curent. Ultima ta rezervare este:</p>
      <p><strong>Curs:</strong> ${escape(p.className)}</p>
      <p><strong>Data:</strong> ${escape(p.date)}</p>
      <p><strong>Ora:</strong> ${escape(p.time)}</p>
      <p>După această sesiune ai nevoie de un abonament nou pentru a putea rezerva în continuare. Îl poți solicita din aplicație, în pagina <strong>Planuri</strong>.</p>
    `,
    sender: "bookings",
  }),

  planRequestReceived: (p) => ({
    subject: `Cerere abonament înregistrată — ${p.planName}`,
    heading: "Cererea ta a fost înregistrată",
    body: `
      <p>Salut, ${escape(p.name)}!</p>
      <p>Ai solicitat abonamentul <strong>${escape(p.planName)}</strong> la prețul de <strong>${escape(p.price)} RON</strong>.</p>
      <p>Pentru activare, achită contravaloarea prin una dintre metodele:</p>
      <ul>
        <li><strong>Transfer bancar</strong> — detaliile sunt în aplicație, în pagina Planuri.</li>
        <li><strong>POS la studio</strong> — card sau Apple/Google Pay la recepție.</li>
        <li><strong>Numerar la studio</strong>.</li>
      </ul>
      <p>După confirmarea plății, abonamentul va fi activat de echipa noastră.</p>
    `,
    sender: "payments",
  }),

  planApproved: (p) => ({
    subject: `Abonament activ — ${p.planName}`,
    heading: "Abonamentul tău este activ!",
    body: `
      <p>Salut, ${escape(p.name)}!</p>
      <p>Abonamentul <strong>${escape(p.planName)}</strong> a fost activat.</p>
      <p><strong>Sesiuni disponibile:</strong> ${escape(p.sessionsTotal)}</p>
      <p><strong>Valabil până la:</strong> ${escape(p.endDate)}</p>
      <p>Poți rezerva sesiuni din aplicație.</p>
    `,
    sender: "payments",
  }),

  planRejected: (p) => ({
    subject: "Cerere abonament — informații suplimentare",
    heading: "Cererea ta necesită clarificări",
    body: `
      <p>Salut, ${escape(p.name)}!</p>
      <p>Cererea pentru abonamentul <strong>${escape(p.planName)}</strong> nu poate fi aprobată momentan.</p>
      <p><strong>Motiv:</strong> ${escape(p.reason || "—")}</p>
      <p>Te rugăm să ne contactezi la <a href="mailto:${escape(BUSINESS.email)}">${escape(BUSINESS.email)}</a>.</p>
    `,
    sender: "hello",
  }),

  expirationWarning: (p) => ({
    subject: `Abonamentul tău expiră în ${p.days} zile`,
    heading: "Abonamentul tău expiră curând",
    body: `
      <p>Salut, ${escape(p.name)}!</p>
      <p>Abonamentul <strong>${escape(p.planName)}</strong> expiră în <strong>${escape(p.days)} zile</strong> (${escape(p.endDate)}).</p>
      <p>Pentru continuitate, solicită un abonament nou din aplicație înainte de expirare.</p>
    `,
    sender: "bookings",
  }),

  lowSessionsWarning: (p) => ({
    subject: `Mai ai ${p.remaining} sesiuni rămase`,
    heading: "Sesiuni puține rămase",
    body: `
      <p>Salut, ${escape(p.name)}!</p>
      <p>Mai ai <strong>${escape(p.remaining)} sesiuni</strong> disponibile în <strong>${escape(p.planName)}</strong>.</p>
      <p>Pregătește-ți următorul abonament pentru a nu rămâne fără sesiuni.</p>
    `,
    sender: "bookings",
  }),

  adminPlanRequestNew: (p) => ({
    subject: `Cerere nouă de abonament — ${p.userName}`,
    heading: "Cerere nouă de abonament",
    body: `
      <p><strong>${escape(p.userName)}</strong> (${escape(p.userEmail)}) a solicitat:</p>
      <ul>
        <li><strong>Plan:</strong> ${escape(p.planName)}</li>
        <li><strong>Preț:</strong> ${escape(p.price)} RON</li>
        <li><strong>Metodă preferată:</strong> ${escape(p.paymentMethod)}</li>
      </ul>
      <p>Aprobă cererea din panoul de administrare după primirea plății.</p>
    `,
    sender: "hello",
  }),
}
