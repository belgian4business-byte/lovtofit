# LOVTOFIT — Projectcontext

Dit bestand beschrijft wat we bouwen en welke regels altijd gelden. Lees het vóór
elke taak. De volledige detailspecificaties staan in de blueprints (v0.1–v3.2);
per taak lever ik de relevante blueprint aan als bron. Verzin niets opnieuw wat
daar al in staat.

## Wat is LOVTOFIT?

Een fitness-app (freemium) die de gebruiker vertelt wat hij vandaag moet trainen,
zodat hij daar zelf niet over hoeft na te denken.
Kernbelofte: **"Je hoeft niet te weten wat je moet trainen. De app denkt met je mee."**
Doelgroepen: beginners, afvallers, efficiënte sporters, en "afhakers" (retentie).

## Tech-stack (vast)

- **Frontend:** Flutter (Android + iOS, één codebase)
- **Backend:** TypeScript + NestJS
- **Database:** PostgreSQL
- **ORM:** Prisma (met migrations)
- **Architectuurregel:** de app praat NOOIT rechtstreeks met de database.
  Altijd: App → API → business logic → database.

## Navigatie (vast)

Onderste balk, 5 tabs: **Home · Train · Progress · Nutrition · Coach**.
Profiel + instellingen zitten achter een tandwiel/avatar rechtsboven (geen tab).
Geen aparte "Premium"-tab; premium tonen via vergrendelde teasers binnen de tabs.
(Code-mapnamen mogen afwijken van tab-labels.)

## Kernprincipes (gelden overal)

- **Engine vs. AI:** de engines nemen alle trainingsbeslissingen met vaste,
  testbare regels (veiligheid + logica). De AI Coach zit daar BOVENOP en doet
  alleen uitleg/communicatie, binnen de grenzen van de engines. Bouw geen AI die
  de app bestuurt.
- **Eenvoud aan de voorkant, complexiteit erachter.** Eén hoofdactie per scherm.
  Een oefening afvinken kost max. 2 tikken.
- **Veiligheid eerst.** Elke gegenereerde workout gaat langs de Rule Guard (harde
  controles: materiaal, locatie, niveau, tijd, herstel). Pijn/discomfort is een
  apart signaal met voorrang, geen "te zwaar".
- **Nooit schuldgevoel.** Een gemiste training is geen straf; help de gebruiker
  opnieuw beginnen.
- **Fitness ≠ medische app.** Geen medische claims, geen nep-precisie (gebruik
  ranges en trends, niet "exact 2.173 kcal").
- **Privacy by design (GDPR/EU):** verzamel alleen wat nodig is; wachtwoorden
  alleen als hash; geen contacten/locatie/microfoon/foto's tenzij echt nodig.

## Datamodel-regels

- Gewicht niet los opslaan maar afleiden uit `body_measurements` (bewaar historie).
- Geschiedenis nooit overschrijven (doelwijziging → oud doel `PAUSED`).
- Feature-toegang centraal via een `FeatureAccessService` (`CAN_USE_*`), niet
  `if premium` verspreid door de code.
- Feedback: `difficulty` enum = EASY / GOOD / HARD / TOO_HARD; UI-labels =
  Makkelijk / Goed / Zwaar / Te zwaar; `discomfort` is een apart veld.

## Hoe we werken

- Bouw in kleine stappen. Na elke stap: leg uit hoe ik test of het werkt, en wacht
  op mijn "oké" voordat je verdergaat.
- Bouw nooit twee dingen tegelijk.
- Begin engines simpel; maak ze pas later slim (geen volledige beslisladder op dag 1).

## Afgeronde fases

### FASE 0 — Walking skeleton
Bewezen: het Flutter-scherm toont data uit onze eigen backend + database
(PostgreSQL in Docker, NestJS + Prisma, `GET /health`).

### FASE 1 — Account & Auth (basis)
Doel: een gebruiker kan een account aanmaken, inloggen en de onboarding-flow
doorlopen. Wachtwoorden worden nooit leesbaar opgeslagen.

**Stap 1: Registreren met e-mail/wachtwoord**
1. Prisma: `User`-model met `email` (uniek) en `passwordHash`.
2. Backend: `POST /auth/register` — valideert e-mail + wachtwoord (min. 8
   tekens), hasht het wachtwoord met bcrypt (nooit plain text opslaan of
   loggen), maakt de gebruiker aan. Geen sessie/token in deze stap.
3. Flutter: registratiescherm met e-mail- en wachtwoordveld, één knop
   "Account aanmaken", duidelijke succes-/foutmelding.

**Stap 2: Inloggen**
1. Backend: `POST /auth/login` — controleert e-mail/wachtwoord tegen de
   opgeslagen hash (bcrypt.compare), geeft bij succes een JWT-token
   (`@nestjs/jwt`, geheim in `JWT_SECRET`) + gebruiker terug. Onbekend
   e-mailadres en fout wachtwoord geven dezelfde generieke 401-foutmelding
   (geen accountgegevens lekken).
2. Flutter: inlogscherm (het startscherm) met e-mail/wachtwoord, link naar
   het registratiescherm en vice versa. Bij succes: eenvoudig
   "ingelogd als"-scherm met uitlog-knop. Token wordt nog niet lokaal
   opgeslagen (geen sessiepersistentie over app-herstarts — dat is een latere
   stap).

**Stap 3: Onboarding-flow**
Bron: "LOVTOFIT Blueprint v0.1-v0.4.docx", sectie 3 "EERSTE START — ONBOARDING".
Eén vraag per scherm, in deze volgorde:
1. Doel (meerdere keuzes mogelijk): Afvallen · Spieren opbouwen · Sterker
   worden · Conditie verbeteren · Fit worden.
2. Locatie (één keuze): 🏠 Thuis · 🏋️ Fitness · 🔄 Beide.
3. Apparatuur (meerdere keuzes): Geen apparatuur · Dumbbells · Elastieken ·
   Kettlebell · Volledige fitnessapparatuur.
4. Tijd (één keuze): 15 min · 30 min · 45 min · 60+ min.
5. Frequentie (één keuze): 2×–6× per week.
6. Niveau (één keuze): Beginner · Gemiddeld · Gevorderd.

Backend: `POST /onboarding` (achter JWT-auth). Doelen volgen de
datamodel-regel: bij een doelwijziging krijgt het oude actieve doel
`PAUSED` i.p.v. verwijderd te worden; nieuwe geselecteerde doelen worden
`ACTIVE`. Overige voorkeuren (locatie/apparatuur/tijd/frequentie/niveau)
staan in `TrainingPreferences` en worden gewoon bijgewerkt (geen historie
nodig). `POST /auth/login` geeft nu ook `hasCompletedOnboarding` terug zodat
de app na login weet of de flow al doorlopen is.

Bewezen: account aanmaken, inloggen, de onboarding-flow doorlopen (één vraag
per scherm) en daarna opnieuw inloggen (zonder de flow opnieuw te zien) werkt
allemaal via de app. In de database staat alleen de wachtwoord-hash, en een
doelwijziging overschrijft nooit het oude doel.

### FASE 2 — De kern-loop

Doel: gebruiker krijgt een training van vandaag, logt sets, rondt af, en
ziet het terug. Logica bewust simpel.
1. (klaar) Kleine oefeningen-set geseed (20, `src/generated/prisma`
   `Exercise`-model: movement pattern, apparatuur, niveau).
2. (klaar) Eén beginner full-body template ("Beginner Full Body":
   squat → push → pull → hinge → core, als regels, niet vaste oefeningen).
3. (klaar) Decision Engine v1 — `DecisionEngineService.getTodaysWorkout()`,
   via `GET /workouts/today` (JWT-auth). Kiest het template dat bij het
   niveau past (nu nog triviaal: er is er maar één), en vult elke slot met
   de eerste oefening die past bij de apparatuur van de gebruiker (bodyweight
   altijd toegestaan; dumbbells/barbell/machine-cable afhankelijk van
   onboarding-apparatuur) en bij voorkeur het exacte niveau. Bewust géén
   score-/progressie-/hersteltellogica — dat komt pas als de engine
   "slimmer" gemaakt wordt.
4. (klaar) Home-scherm toont "Training van vandaag" (template + oefeningen
   uit `GET /workouts/today`) + Start-knop. Nog geen tabbalk/Progress/Coach
   — die komen pas als die schermen echt bestaan.
5. (klaar) Workout-scherm: een set afvinken kost één tik ("SET KLAAR"),
   daarna automatisch een rusttimer (45 sec, overslaan kan), en na de
   laatste set van een oefening één tik naar de volgende ("Volgende
   oefening →" / "Training afronden"). `targetSets`/`targetReps` (vast op
   3×12, MVP-simplificatie) komen nu mee in `GET /workouts/today`.
   Loggen gebeurt nog alleen lokaal in de app — nog niet opgeslagen.
6. (klaar) Sessie opslaan: `WorkoutSession` + `LoggedSet`-modellen
   (gekoppeld aan user/template/exercise). `POST /workouts/sessions`
   (JWT-auth) slaat de hele sessie in één keer op zodra de training is
   afgerond — geen tussentijdse "gestart maar niet afgerond"-status.
   Feedback (moeilijkheidsgraad/pijn) wordt hier nog niet gevraagd; als dat
   gebouwd wordt, geldt de vaste `difficulty`-enum uit CLAUDE.md.
7. (klaar) Basis Progress-scherm: `GET /workouts/sessions` (JWT-auth) geeft
   de sessies van de ingelogde gebruiker terug (nieuwste eerst, met
   templatenaam en oefeningnamen i.p.v. losse ids). Flutter-scherm toont per
   sessie datum, template en oefeningen; leeg-status voor nieuwe gebruikers.
   Bereikbaar via een icoon in de Home-AppBar — bewust nog geen volledige
   5-tabbalk, want Train/Nutrition/Coach bestaan nog niet.

Bewezen: openen → training van vandaag → loggen → afronden → terugzien in
Progress werkt allemaal via de app.

## Huidige fase

Nog te bepalen — lever de volgende blueprint-sectie aan zodra je klaar bent
om verder te gaan.
