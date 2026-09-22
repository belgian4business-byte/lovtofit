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

### FASE 3 — Engines slimmer maken

Eén engine per keer, telkens met de bijbehorende blueprint als bron.
Volgorde:
1. (klaar) Feedback-flow (bron: blueprint v2.12, sectie 2.12.7-2.12.8). Na
   elke oefening (niet elke set) vraagt de app "Hoe voelde deze oefening?"
   (😊 Makkelijk/🙂 Goed/😐 Zwaar/😣 Te zwaar) + apart "Had je ongemak of
   pijn?" (Nee/Ja) — beide verplicht voordat de gebruiker verder kan.
   Backend: `ExerciseFeedback`-model (`difficulty` enum + `discomfort`
   boolean, per oefening per sessie), meegestuurd in dezelfde
   `POST /workouts/sessions`-call als de gelogde sets. Bewust nog géén
   reactie op de feedback (geen stoppen/alternatief bij pijn) — dat is
   waar de Progression/Decision Engine (stap 2/4) voor zijn.
2. (klaar) Progression Engine (bron: blueprint v0.8 + v2.14, pseudocode
   v2.14.13). `ProgressionEngineService.evaluateSession()` draait
   automatisch na elke opgeslagen sessie (in `WorkoutSessionsService.save`)
   en bepaalt per oefening met feedback: KEEP/INCREASE/DECREASE/REPLACE.
   Regels, in volgorde: discomfort → altijd REPLACE (voorrang boven alles);
   geen historie voor deze oefening → KEEP; 3× op rij Te zwaar → DECREASE;
   3× op rij Makkelijk → INCREASE; geïsoleerde matige/slechte feedback
   (niet herhaald) → KEEP; betere prestatie dan vorige keer (meer reps/
   gewicht) + Makkelijk/Goed → INCREASE; anders KEEP. Beslissing wordt
   bewaard in `ExerciseProgression` (geheugen voor de trend-detectie) en
   meegegeven in de `POST /workouts/sessions`-response. ADJUST is nog niet
   geïmplementeerd (vereist Recovery Engine-context uit stap 3). Bewust nog
   géén koppeling naar de Decision Engine — de beslissing wordt nu alleen
   bepaald en bewaard, nog niet uitgevoerd (dat is stap 4).
3. (klaar) Recovery Engine (bron: blueprint v0.9 + v2.15).
   `RecoveryEngineService.getStatus()` via `GET /recovery/status`
   (JWT-auth). Schat, per movement pattern én per spiergroep, de recente
   trainingsbelasting (afgelopen 7 dagen) en geeft één van drie statussen
   terug: 🟢 NORMAL, 🟡 RECENTLY_LOADED, 🔵 RECOVERY. Score = reps ×
   moeilijkheidsgewicht (EASY 0,7 – TOO_HARD 1,6) × recency-verval (vandaag
   1,0, aflopend naar 7+ dagen 0,1) — geen harde "48 uur rust"-regel, geen
   nep-precisie zoals percentages (v2.15.1/v2.15.8). On-the-fly berekend
   uit bestaande sessie-/feedbackdata, geen aparte tabel nodig. Bewust nog
   géén koppeling naar de Decision Engine — dit is een modifier die
   informatie levert, maar (nog) niemand raadpleegt hem (v2.15.3; wordt
   stap 4).
4. (klaar) Decision Engine v2 (bron: blueprint v0.7 + v1.9) —
   `DecisionEngineService.getTodaysWorkout()` is nu een echte beslisladder
   i.p.v. simpele eerste-match. Per slot:
   1. VEILIGHEID (hard, nooit overschreven): niveau-tiering (beginner
      krijgt alleen beginner-oefeningen, v1.9 stap 3), apparatuur, en een
      oefening met de laatste Progression-beslissing REPLACE (= recent
      pijn/ongemak) wordt uitgesloten zolang er een alternatief is
      (v0.7.5/v0.7.9: "zwaar" mag aanpassen, "pijn" sluit uit).
   2. SLIM (score, prioriteitsvolgorde uit v0.7.6): recente belasting/
      herstel (RECENTLY_LOADED/RECOVERY → lichtste variant krijgt
      voorrang) weegt zwaarder dan progressie (INCREASE/KEEP/DECREASE),
      wat weer zwaarder weegt dan een kale niveauvoorkeur. Continuïteit
      (dezelfde oefening als vorige keer) krijgt ook gewicht — "niet
      iedere keer nieuwe oefeningen" (v0.7.7).
   3. Reps passen automatisch mee met de progressiebeslissing van de
      gekozen oefening (INCREASE +2, DECREASE -2, binnen 6-20).
   Live geverifieerd: na een pijnmelding op een PUSH-oefening kiest de
   engine bij de volgende `/workouts/today`-call automatisch een andere
   PUSH-oefening.
   **Bewust uitgesteld** (vereisen nieuwe schermen/inputs die nog niet
   bestaan): Quick Session bij tijdgebrek, energie-check-in, weekplanning
   + "gemiste training"-herplanning, handmatige "vandaag aanpassen"-
   overrides (locatie/tijd/energie/oefening vervangen via de UI), en een
   echte oefening-progressieladder (regressie/progressie gebeurt nu via
   reps, niet via het wisselen naar een makkelijkere/moeilijkere variant).
5. (klaar) Rule Guard (bron: blueprint v2.06) — `RuleGuardService`, een
   onafhankelijke controle NA de Decision Engine ("Mag deze workout
   daadwerkelijk aan deze gebruiker worden gegeven?", v2.6.1), niet
   opnieuw dezelfde beslissingslogica. Alle 12 RG-controles zijn
   geïmplementeerd, verdeeld in twee soorten:
   - **Hard (blokkeert, gooit een fout):** RG01 apparatuur, RG02 locatie
     (geen gym-machines thuis), RG03 niveau, RG06 progressiesprong-check
     (reps altijd 6-20), RG07 volume (max. 30 sets), RG08 training-debt
     (geen samengevoegde workouts), RG10 geen dubbele oefening in één
     workout + geen dubbele set bij opslaan (`assertNoDuplicateSets`),
     RG11 workout niet leeg.
   - **Soft (waarschuwing in de response, blokkeert niet):** RG04 tijd
     (geschatte duur vs. beschikbare tijd — kan nog niet opgelost worden
     zonder Quick Session), RG05 herstel (patroon op RECOVERY, Decision
     Engine kiest al de lichtste variant maar traint het toch), RG09 pijn
     (oefening ondanks REPLACE gekozen — kan alleen bij géén alternatief,
     zie Decision Engine-fallback).
   - RG12 (gebruikerscontrole: vervangen/aanpassen/stoppen/overslaan) is
     een UI-garantie, geen data-check — al gedekt door bestaande navigatie
     (wegnavigeren, rust overslaan); een losse "vervang oefening"-knop
     bestaat nog niet.
   Live geverifieerd: dubbele set bij opslaan → 400; een MIN_15-gebruiker
   krijgt een eerlijke RG04-waarschuwing ("~21 min overschrijdt de 15 min")
   in plaats van een stille mismatch.
6. (klaar) Motivation Engine (bron: blueprint v1.2 + v2.16) —
   `MotivationEngineService.getStatus()` via `GET /motivation/status`
   (JWT-auth). Levert een gedragssignaal, geen tekst — dat is bewust de
   taak van de (latere) AI Coach (v2.16.15: "De Engine levert het
   feitelijke signaal. AI verzorgt de menselijke communicatie.").
   We hebben nog geen dag-voor-dag weekplanning (bewust uitgesteld bij
   Decision Engine), dus het "plan" waarmee vergeleken wordt is
   `weeklyFrequency` uit onboarding: heeft de gebruiker deze week zijn
   eigen doel gehaald? Dat sluit vanzelf uit dat een losse rustdag de
   streak breekt — er wordt nooit naar losse kalenderdagen gekeken, enkel
   naar de week als geheel.
   Signalen (prioriteitsvolgorde uit v2.16.16): RETURN_AFTER_ABSENCE
   (14+ dagen niets gedaan) > MILESTONE_REACHED (1/5/10/25/50/100
   trainingen) > CONSISTENCY_GOOD (weekdoel al gehaald) >
   AT_RISK_OF_DROPOUT (3 volledig afgeronde weken op rij onder doel) >
   CONSISTENCY_DECLINING (afgeronde week zwakker dan de week ervoor) >
   NORMAL. Belangrijke correctie t.o.v. de blueprint-pseudocode: de
   lopende week (nog niet voorbij) wordt nooit gebruikt om een "daling"
   vast te stellen — dat zou een week die simpelweg nog niet klaar is
   oneerlijk als achteruitgang bestempelen; dalingsdetectie gebruikt
   uitsluitend volledig afgeronde weken.
   `consistencyStreakWeeks`: aantal opeenvolgende weken (incl. de lopende,
   als die het doel al haalde) dat het weekdoel gehaald werd.
   **Bewust niet gebouwd** (badges/mijlpaal-UI, challenges, weekly-goal-
   scherm, notificaties, leaderboard) — dat is UI/presentatie, geen
   engine-logica, en zit buiten de goedgekeurde scope van deze stap.
7. (klaar) AI Coach (bron: blueprint v1.0 + v2.18) — `AiCoachService`,
   bewust **deterministisch/template-gebaseerd, geen LLM-koppeling**
   (expliciet overlegd en gekozen i.p.v. een echte taalmodel-API, wat een
   aparte infrastructuur-/kostenbeslissing zou zijn). Vertaalt de al-
   berekende signalen (reason codes) van Motivation/Progression/Recovery
   naar een korte Nederlandse tekst — beslist zelf niets, overschrijft
   nooit een engine ("De Engines beslissen. De AI legt uit.", v2.18.1).
   - `coachMessage` bij `GET /workouts/today`: legt uit waarom de training
     er zo uitziet, in prioriteitsvolgorde: RETURN_AFTER_ABSENCE > net
     vervangen oefening (pijn/ongemak) > recent belast patroon > dalende
     consistentie > consistent op schema > neutraal.
   - `coachMessage` bij `POST /workouts/sessions`: legt uit hoe de training
     ging. Pijn/ongemak krijgt altijd voorrang (geen diagnose, erkent enkel
     en legt uit wat er verandert) — ook boven een mijlpaal.
   Per constructie onmogelijk om medische claims of verzonnen cijfers te
   geven (v2.18.3): puur templates op gecontroleerde input, geen vrije
   tekstgeneratie. Live geverifieerd: alle scenario's (welkom terug,
   pijn/ongemak, mijlpaal, neutraal) leveren de juiste, veilige tekst.

Regel: engines nemen beslissingen met vaste regels; AI komt er pas
bovenop.

Bewezen: alle 6 engines (Progression, Recovery, Decision, Rule Guard,
Motivation, AI Coach) werken samen — een gebruiker die pijn meldt krijgt
volgende keer automatisch een andere oefening (Decision Engine + Rule
Guard), de Progression Engine bepaalt op basis van feedback en trend wat
er moet veranderen, de Recovery Engine houdt rekening met recente
belasting, de Motivation Engine herkent consistentie/afwezigheid/
mijlpalen zonder ooit te straffen, en de AI Coach legt dit alles uit in
korte, veilige Nederlandse tekst — zonder zelf ooit een beslissing te
nemen.

## Huidige fase

Nog te bepalen — lever de volgende blueprint-sectie aan zodra je klaar
bent om verder te gaan.
