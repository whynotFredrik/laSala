# ACORD PRIVIND PRELUCRAREA DATELOR PERSONALE ȘI REGULAMENT INTERN
## LASALA FITNESS STUDIO

**Versiunea 1.0**

> **⚠ NOTĂ — necesită revizuire juridică.** Acest document a fost actualizat pentru a reflecta arhitectura tehnică și fluxurile reale ale aplicației Lasala Fitness Studio. Înainte de publicare, secțiunile marcate cu **[REVIZUIRE]** trebuie verificate de un avocat român cu experiență GDPR. După aprobare, ștergeți toate notele marcate **[REVIZUIRE]** și publicați documentul prin **/admin/gdpr**.

---

## I. PRELUCRAREA DATELOR PERSONALE (GDPR)

### 1. Operator de Date

**Lasala Fitness Studio S.R.L.** _[REVIZUIRE: confirmați denumirea juridică exactă, CUI, J.]_
Adresa: Str. Evreilor Deportați 14, Oradea, România
Email: hello@lasalastudio.ro
Telefon: 0770 431 340

### 2. Scopul Prelucrării Datelor

Prin crearea contului și utilizarea serviciilor Lasala Fitness Studio, consimțiți ca datele dumneavoastră personale să fie prelucrate în următoarele scopuri:

**a) Gestionarea abonamentului:**
- Procesarea cererilor de abonament și activarea acestora
- Evidența sesiunilor de antrenament rezervate și utilizate
- Notificări privind expirarea abonamentului
- Înregistrarea plăților efectuate (transfer bancar, POS, numerar)

**b) Comunicare:**
- Trimiterea de notificări despre rezervările dumneavoastră
- Confirmări de rezervare, anulare și reprogramare
- Informații despre modificări ale programului
- Comunicări privind starea contului

**c) Îmbunătățirea serviciilor:**
- Analiza utilizării serviciilor pentru îmbunătățiri operaționale
- Statistici interne privind frecvența antrenamentelor
- Feedback și satisfacția clienților

### 3. Date Personale Colectate

- **Date de identificare:** nume complet, email, număr telefon
- **Date de cont:** parolă (stocată sub formă criptată — bcrypt, prin Supabase Auth)
- **Date de abonament:** tip abonament, data de început și sfârșit, sesiuni utilizate
- **Date de rezervare:** istoric rezervări, anulări, reprogramări, înghețări
- **Date opționale (introduse voluntar de membru):** greutate, obiective, chestionar dietetic, fotografii de progres
- **Date tehnice (anonimizate cât posibil):** adresă IP, dispozitiv, browser — folosite pentru securitatea contului

### 4. Baza Legală a Prelucrării

Prelucrarea datelor se bazează pe:

- **Consimțământul dumneavoastră explicit** (Art. 6(1)(a) GDPR) — pentru date opționale (chestionar dietetic, fotografii de progres, marketing)
- **Executarea contractului** de abonament (Art. 6(1)(b) GDPR) — pentru gestionarea abonamentului și a rezervărilor
- **Obligații legale** (Art. 6(1)(c) GDPR) — pentru emiterea facturilor și păstrarea documentelor contabile

### 5. Durata Păstrării Datelor

- **Date cont activ:** pe durata utilizării serviciilor
- **Date financiare:** **5 ani** (conform legislației contabile române)
- **Date opționale (chestionar, fotografii):** până la retragerea consimțământului
- **După închiderea contului:** datele de identificare se șterg, iar datele agregate (statistici) se anonimizează

### 6. Drepturile Dumneavoastră

Conform GDPR (Regulamentul UE 2016/679), aveți următoarele drepturi:

**a) Dreptul de acces (Art. 15)** — să solicitați o copie a datelor dumneavoastră personale.

**b) Dreptul la rectificare (Art. 16)** — să corectați datele incorecte sau incomplete (puteți face acest lucru singur din pagina **Profil**).

**c) Dreptul la ștergere / "dreptul de a fi uitat" (Art. 17)** — să solicitați ștergerea datelor în condițiile prevăzute de lege.

**d) Dreptul la restricționarea prelucrării (Art. 18)** — să limitați prelucrarea datelor în anumite situații.

**e) Dreptul la portabilitatea datelor (Art. 20)** — să primiți datele într-un format structurat, ușor de utilizat și citit automat.

**f) Dreptul de a vă retrage consimțământul (Art. 7(3))** — în orice moment, fără afectarea legalității prelucrării anterioare.

**g) Dreptul de a depune plângere** la **Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP)**.

**Pentru exercitarea drepturilor, contactați:** hello@lasalastudio.ro

### 7. Securitatea Datelor

Implementăm măsuri tehnice și organizatorice pentru protecția datelor:

- Criptare TLS 1.2+ pentru transmiterea datelor
- Parole stocate criptat (bcrypt, prin furnizorul de autentificare Supabase)
- Servere securizate (infrastructură Supabase, regiunea Frankfurt — UE)
- Backup-uri automate zilnice cu posibilitatea de restaurare punctuală (point-in-time recovery)
- Acces la date doar pentru personalul autorizat (rolul "admin"), prin politici de securitate la nivel de rând (Row-Level Security) în baza de date
- Fotografiile de progres sunt stocate în zone private, accesibile doar membrului care le-a încărcat

### 8. Partajarea Datelor

Datele dumneavoastră pot fi partajate cu:

- **Supabase Inc.** (furnizor de bază de date și autentificare) — servere în UE (Frankfurt), conform GDPR
- **Resend** (furnizor de email) — pentru notificări tranzacționale, conform GDPR
- **Vercel Inc.** (hosting aplicație) — date tehnice de cerere, conform GDPR
- **Autorități fiscale române** (conform obligațiilor legale)

**Nu vindem și nu partajăm datele cu terțe părți pentru marketing.**

### 9. Plăți

Aplicația **nu procesează plăți online**. Plata abonamentului se efectuează prin:

- **Transfer bancar** (detaliile bancare sunt afișate în pagina Planuri)
- **Card bancar la studio (POS)**
- **Numerar la studio**

Datele cardului bancar nu trec prin aplicația noastră — sunt procesate direct de banca dumneavoastră prin terminalul POS al studioului.

---

## II. REGULAMENT INTERN — LASALA FITNESS STUDIO

### 1. Condiții Generale de Utilizare

**1.1 Eligibilitate:**
- Vârsta minimă: **18 ani** (sau 16 ani cu acordul scris al părinților)
- Stare de sănătate: membrii sunt responsabili pentru propria stare de sănătate
- Recomandăm consultarea unui medic înainte de începerea antrenamentelor

**1.2 Tipuri de Abonamente:** _[REVIZUIRE: confirmați tarifele și pachetele active]_

**Abonamente Lunare:**
- 8 sesiuni / lună
- 12 sesiuni / lună
- 16 sesiuni / lună
- 20 sesiuni / lună

**Abonament Promoțional 6 luni:**
- Pachet pe 6 luni cu reducere — sesiunile sunt distribuite pe toată durata.

**1.3 Valabilitate:**
- Abonamentele lunare sunt valabile **30 zile** de la activare
- Abonamentul de 6 luni este valabil **180 zile** de la activare
- Sesiunile nefolosite expiră la sfârșitul perioadei

### 2. Rezervări și Anulări

**2.1 Rezervare Sesiuni:**
- Rezervările pentru săptămâna viitoare se deschid **DUMINICA la ora 00:00** (ora României)
- Maxim **1 sesiune per zi**
- Rezervarea se face exclusiv prin aplicație

**2.2 Anulare Rezervare:**
- Anulare gratuită: **cu minim 3 ore înainte** de începerea sesiunii
- Anulare în ultimele 3 ore: sesiunea se consideră consumată
- Neprezentare fără anulare: sesiunea se consideră consumată

**2.3 Reprogramare:**
- Permisă doar dacă există locuri disponibile
- Maxim **2 reprogramări per săptămână** (luni–duminică, conform săptămânii ISO)
- Reprogramarea respectă aceeași regulă de 3 ore înainte de sesiunea originală

### 3. Înghețarea Abonamentului (Freeze)

**3.1 Condiții Înghețare:**
- Disponibil: **maxim 14 zile** la fiecare **6 luni** (perioadă mobilă) de abonament activ
- Solicitare: cu minim **48 de ore** înainte
- Perioadă minimă: **3 zile** consecutive
- Perioadă maximă: **14 zile** consecutive

**3.2 Procedură:**
- Solicitare prin aplicație (Profil → Înghețare abonament)
- Pe perioada înghețării: nu se pot face rezervări
- După dezghețare: data de expirare a abonamentului se prelungește cu numărul de zile înghețate

**3.3 Restricții:**
- Nu se pot îngheța abonamente expirate
- Nu se poate îngheța dacă au fost folosite deja 14 zile în ultimele 6 luni

### 4. Plăți și Facturare

**4.1 Metode de plată:**
- Transfer bancar
- Card bancar la studio (POS)
- Numerar la studio

**4.2 Reînnoire:**
- Reînnoire manuală: din pagina **Planuri**, prin solicitare către administrator. Activarea se face după confirmarea plății.

**4.3 Rambursări:** _[REVIZUIRE: confirmați politica de rambursare conform legislației române — Codul Consumatorului]_

### 5. Norme de Conduită în Sală

**5.1 Obligatoriu:**
- Echipament sportiv curat și adecvat
- Încălțăminte sport curată (schimbată în sală)
- Prosop personal
- Respect față de antrenori și ceilalți membri

**5.2 Interzis:**
- Fotografii sau filmări fără acordul persoanelor prezente
- Comportament agresiv sau limbaj obscen
- Consumul de alcool sau substanțe interzise
- Fumatul în incinta sălii

**5.3 Siguranță:**
- Folosirea echipamentelor conform instrucțiunilor
- Raportarea oricărei defecțiuni
- Purtarea echipamentului de protecție unde este cazul

### 6. Responsabilitate

**6.1 Răspunderea Sălii:**
- Echipamente funcționale și sigure
- Personal calificat
- Curățenie și igienă

**6.2 Răspunderea Membrului:**
- Starea propriei sănătăți
- Utilizarea corectă a echipamentelor
- Respectarea regulamentului
- Obiectele personale

**6.3 Limitări:**
- Lasala Fitness Studio nu răspunde pentru:
  - Vătămări cauzate de nerespectarea instrucțiunilor
  - Pierderea sau furtul obiectelor personale
  - Accidente cauzate de neglijență proprie

### 7. Modificări și Reziliere

**7.1 Modificarea regulamentului:**
- Ne rezervăm dreptul de a modifica regulamentul. Notificare prin email cu cel puțin **14 zile** înainte de intrarea în vigoare.

**7.2 Rezilierea de către sală:**
- La încălcarea repetată a regulamentului
- Pentru comportament inadecvat
- Fără rambursare în cazul rezilierii disciplinare

### 8. Protecția Sănătății

**8.1 Declarație pe proprie răspundere:**
- Membrul declară că este apt fizic pentru antrenamente
- În caz de probleme medicale: consultați medicul înainte

**8.2 Situații medicale:**
- Informați antrenorul despre condiții medicale relevante
- Opriți antrenamentul dacă simțiți durere sau disconfort
- Solicitați ajutor medical la nevoie

---

## III. CONSIMȚĂMÂNT ȘI ACCEPTARE

Prin bifarea căsuței și crearea contului, confirm și declar că:

- Am citit și înțeles **Acordul privind Prelucrarea Datelor Personale**
- Am citit și înțeles **Regulamentul Intern Lasala Fitness Studio**
- Consimt la prelucrarea datelor mele personale conform GDPR
- Accept termenii și condițiile de utilizare
- Mă angajez să respect regulamentul intern
- Declar că sunt apt fizic pentru activități sportive
- Înțeleg și accept politica de anulare și înghețare

**Drepturi:**
- Pot retrage acest consimțământ oricând contactând hello@lasalastudio.ro
- Pot solicita ștergerea contului și a datelor mele
- Pot depune plângere la **ANSPDCP** (www.dataprotection.ro)

---

## IV. CONTACT

**Pentru întrebări despre:**
- Date personale (GDPR): hello@lasalastudio.ro
- Abonamente și facturare: hello@lasalastudio.ro
- Probleme tehnice: hello@lasalastudio.ro
- Telefon: 0770 431 340

**Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP)**
- Website: www.dataprotection.ro
- Email: anspdcp@dataprotection.ro
- Telefon: +40 21 252 5599

---

© Lasala Fitness Studio. Toate drepturile rezervate.
