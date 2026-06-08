/**
 * Email copy for Lasala Fitness Studio transactional emails.
 * These are content templates, not full HTML — wrap each in your shared layout
 * (header with logo, footer with unsubscribe info) when sending via Resend.
 *
 * Drop into `lib/email/templates/` when wiring up.
 */

export const emailTemplates = {
  welcome: {
    subject: 'Bine ai venit la Lasala Fitness Studio',
    heading: 'Bine ai venit, {{name}}!',
    body: `
      <p>Contul tău la Lasala Fitness Studio a fost creat cu succes.</p>
      <p>Pentru a începe să rezervi sesiuni, alege un abonament din aplicație.</p>
      <p>Ne vedem la antrenament!</p>
    `,
    sender: 'hello',
  },

  bookingConfirmation: {
    subject: 'Rezervare confirmată — {{date}} ora {{time}}',
    heading: 'Rezervarea ta este confirmată!',
    body: `
      <p>Salut, {{name}}!</p>
      <p><strong>Curs:</strong> {{className}}</p>
      <p><strong>Data:</strong> {{date}}</p>
      <p><strong>Ora:</strong> {{time}}</p>
      <p>Te așteptăm la studio. Dacă nu mai poți ajunge, anulează cu cel puțin 3 ore înainte.</p>
      <p>Adresa: Str. Evreilor Deportați 14, Oradea</p>
    `,
    sender: 'bookings',
  },

  bookingCancellation: {
    subject: 'Rezervare anulată — {{date}} ora {{time}}',
    heading: 'Rezervarea ta a fost anulată',
    body: `
      <p>Salut, {{name}}!</p>
      <p>Ai anulat rezervarea pentru <strong>{{className}}</strong>, {{date}} la ora {{time}}.</p>
      <p>Sesiunea a fost reactivată în planul tău.</p>
    `,
    sender: 'bookings',
  },

  bookingReschedule: {
    subject: 'Rezervare reprogramată',
    heading: 'Rezervarea ta a fost reprogramată',
    body: `
      <p>Salut, {{name}}!</p>
      <p>Noua ta rezervare:</p>
      <p><strong>Data:</strong> {{newDate}} la ora {{newTime}}</p>
      <p><strong>Curs:</strong> {{className}}</p>
    `,
    sender: 'bookings',
  },

  planRequestReceived: {
    subject: 'Cerere abonament înregistrată — {{planName}}',
    heading: 'Cererea ta a fost înregistrată',
    body: `
      <p>Salut, {{name}}!</p>
      <p>Ai solicitat abonamentul <strong>{{planName}}</strong> la prețul de <strong>{{price}} RON</strong>.</p>
      <p>Plata se face fizic la studio, prin una dintre metodele:</p>
      <ul>
        <li><strong>POS la studio</strong>: card sau Apple/Google Pay la recepție.</li>
        <li><strong>Numerar la studio</strong>.</li>
      </ul>
      <p>După confirmarea plății, abonamentul tău va fi activat de echipa noastră.</p>
    `,
    sender: 'payments',
  },

  planApproved: {
    subject: 'Abonament activ — {{planName}}',
    heading: 'Abonamentul tău este activ!',
    body: `
      <p>Salut, {{name}}!</p>
      <p>Abonamentul <strong>{{planName}}</strong> a fost activat.</p>
      <p><strong>Sesiuni disponibile:</strong> {{sessionsTotal}}</p>
      <p><strong>Valabil până la:</strong> {{endDate}}</p>
      <p>Poți rezerva sesiuni din aplicație.</p>
    `,
    sender: 'payments',
  },

  planRejected: {
    subject: 'Cerere abonament — informații suplimentare necesare',
    heading: 'Cererea ta necesită clarificări',
    body: `
      <p>Salut, {{name}}!</p>
      <p>Cererea pentru abonamentul <strong>{{planName}}</strong> nu poate fi aprobată momentan.</p>
      <p><strong>Motiv:</strong> {{reason}}</p>
      <p>Te rugăm să ne contactezi la {{contactEmail}} pentru a rezolva situația.</p>
    `,
    sender: 'hello',
  },

  expirationWarning: {
    subject: 'Abonamentul tău expiră în {{days}} zile',
    heading: 'Abonamentul tău expiră curând',
    body: `
      <p>Salut, {{name}}!</p>
      <p>Abonamentul tău <strong>{{planName}}</strong> expiră în <strong>{{days}} zile</strong> ({{endDate}}).</p>
      <p>Pentru continuitate, solicită un abonament nou din aplicație înainte de expirare.</p>
    `,
    sender: 'bookings',
  },

  lowSessionsWarning: {
    subject: 'Mai ai {{remaining}} sesiuni rămase',
    heading: 'Sesiuni puține rămase',
    body: `
      <p>Salut, {{name}}!</p>
      <p>Mai ai <strong>{{remaining}} sesiuni</strong> disponibile în abonamentul tău <strong>{{planName}}</strong>.</p>
      <p>Pregătește-ți următorul abonament pentru a nu rămâne fără sesiuni.</p>
    `,
    sender: 'bookings',
  },

  // Admin notifications

  adminPlanRequestNew: {
    subject: 'Cerere nouă de abonament — {{userName}}',
    heading: 'Cerere nouă de abonament',
    body: `
      <p><strong>{{userName}}</strong> ({{userEmail}}) a solicitat:</p>
      <ul>
        <li><strong>Plan:</strong> {{planName}}</li>
        <li><strong>Preț:</strong> {{price}} RON</li>
        <li><strong>Metodă preferată:</strong> {{paymentMethod}}</li>
      </ul>
      <p>Aprobă cererea din panoul de administrare după primirea plății.</p>
    `,
    sender: 'hello',
  },
} as const;
