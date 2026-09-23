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

## Lokaal draaien & testen

1. **Database:** Docker Desktop starten; de container `lovtofit-postgres`
   start dan vanzelf (`restart: unless-stopped`, `backend/docker-compose.yml`).
2. **Backend:** `cd backend` → `npm run start:dev` (poort 3000, luistert op
   alle netwerkinterfaces). Check: `http://localhost:3000/health`.
3. **Frontend in de browser:** `cd frontend` →
   `flutter run -d web-server --web-port 8080`, openen in een vers
   incognitovenster (eerst alle Chrome-vensters sluiten, anders oude cache).

### App op een echte Android-telefoon

De backend-URL staat op één plek: `frontend/lib/api_config.dart`
(`apiBaseUrl`, via `--dart-define=API_BASE_URL`, standaard
`http://localhost:3000` voor de browser). Een telefoon kent de pc niet als
`localhost`, dus geef het wifi-IP van de pc mee. Cleartext `http://` is
alleen in debug-builds toegestaan (`android/app/src/debug/AndroidManifest.xml`);
een release-build blijft het blokkeren (productie → https).

Eenmalig op de telefoon: Ontwikkelaarsopties aan (7× tikken op
Buildnummer), USB-foutopsporing aan, via een datakabel aansluiten en
"USB-foutopsporing toestaan" → "Altijd toestaan vanaf deze computer".

Elke keer:
1. Telefoon en pc op **hetzelfde wifi-netwerk**; backend draait (stap 2
   hierboven).
2. IP van de pc opzoeken (kan per netwerk/router veranderen):
   `Get-NetIPAddress -AddressFamily IPv4` → het adres bij `Wi-Fi`
   (bv. `192.168.0.140`).
3. Toestel-id opzoeken: `flutter devices` (de CPH2247 = `26eada21`).
4. `cd frontend` →
   `flutter run -d <toestel-id> --dart-define=API_BASE_URL=http://<pc-ip>:3000`
   (eerste build ~3 min, daarna veel sneller). De app installeert en start
   vanzelf; daarna mag de kabel eruit — hij werkt via wifi zolang de
   backend draait.

Werkt inloggen niet ("Kan geen verbinding maken met de server")? Check
vanaf de telefoon zelf of de backend bereikbaar is:
`adb -s <toestel-id> shell "curl -s -m 5 http://<pc-ip>:3000/health"`
(adb staat in `%LOCALAPPDATA%\Android\Sdk\platform-tools\`). Geen
`{"status":"ok"}` → ander wifi-netwerk, pc in slaap, of de Windows-firewall
blokkeert Node.js op dit netwerk.

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

### FASE 4 — Engines zichtbaar maken in de app

Doel: de engine-logica uit Fase 3 zichtbaar maken voor de gebruiker. Eén
stap per keer.
1. (klaar) Onderste navigatiebalk (`MainShell`, `NavigationBar` volgens de
   huisstijl) met 5 tabs: Home / Train / Progress / Nutrition / Coach.
   Tandwiel rechtsboven (`SettingsMenuButton`, gedeeld over alle tabs) met
   "Uitloggen" — geen apart profielscherm nog.
   - **Train** = het bestaande "training van vandaag"-scherm (voorheen
     Home), verplaatst naar `train_screen.dart`.
   - **Home** = nieuw, bewust minimaal welkomstscherm — wordt in stap 3
     aangevuld met streak + recovery-status.
   - **Progress** = bestaand scherm, ongewijzigd.
   - **Nutrition/Coach** = gedeelde `PlaceholderTabScreen`
     ("Komt binnenkort beschikbaar").
   Login/onboarding navigeren nu naar `MainShell` i.p.v. rechtstreeks naar
   één scherm.
2. (klaar) Coach-tab: toont de AI Coach-berichten uit de engines —
   `coachMessage` van vandaag (`GET /workouts/today`, `AiCoachService.
   explainTodaysWorkout()`) plus een geschiedenis van eerdere sessies.
   Daarvoor is `coachMessage` nu ook opgeslagen op `WorkoutSession` (nieuwe
   nullable kolom, migratie `add_session_coach_message`) zodat
   `GET /workouts/sessions` ('m via `WorkoutSessionsService.listForUser()`)
   ook oudere berichten kan teruggeven, niet alleen dat van vandaag.
   Pure weergave — de tekst zelf komt volledig uit de bestaande
   (deterministische) `AiCoachService`.
   **Bugfix onderweg ontdekt:** `MainShell` houdt alle 5 tabs continu in
   leven via een `IndexedStack` (voor behoud van state), waardoor
   `ProgressScreen` en `CoachScreen` hun data maar één keer ophaalden — bij
   het opstarten van de app, vóór er die sessie iets getraind was. Beide
   schermen krijgen nu een `isActive`-flag van `MainShell` en verversen
   zichzelf via `didUpdateWidget` zodra ze de actieve tab worden, zodat een
   net afgeronde training meteen zichtbaar is zonder handmatige refresh.
   Live geverifieerd: na een training afronden tonen zowel Progress als
   Coach de nieuwe sessie direct bij het wisselen naar die tab.
3. (klaar) Home-tab: toont de consistency-streak (Motivation Engine,
   `GET /motivation/status`, `consistencyStreakWeeks` + "deze week X van
   de Y trainingen") en de recovery-status per spiergroep (Recovery
   Engine, `GET /recovery/status`, `byMuscleGroup` — 🟢 Fris/🟡 Recent
   belast/🔵 Herstellend). Pure weergave, geen backend-wijzigingen nodig
   (beide endpoints bestonden al). Zelfde `isActive`-ververspatroon als
   Progress/Coach.
4. (klaar) Na een training: per oefening de progressie-uitkomst tonen
   ("Ging goed — volgende keer proberen we 14 reps." / "Volgende keer
   kiezen we een andere oefening." / etc.). De reps-berekening
   (INCREASE +2 / DECREASE -2, binnen 6-20) stond al in de Decision
   Engine (`repsFor`) maar alleen als private methode voor het
   samenstellen van `/workouts/today` — nu geëxporteerd als losse functie
   `repsForProgressionDecision` (decision-engine.service.ts) zodat er
   geen tweede plek met dezelfde 6-20-clamping-regel ontstaat.
   `AiCoachService.explainProgressionOutcome()` (nieuw) vertaalt de
   KEEP/INCREASE/DECREASE/REPLACE-beslissing naar de Nederlandse zin
   ("De Engines beslissen. De AI legt uit.", zelfde principe als de
   bestaande coachMessage-teksten). `POST /workouts/sessions` geeft dit
   nu terug als `progressionOutcomes` (per oefening: naam, decision,
   message) — dit vervangt de eerdere kale `progressionDecisions`-lijst
   (nog nergens in de app gebruikt, dus veilig om te vervangen i.p.v.
   naast elkaar te laten bestaan). Workout-scherm toont de lijst onder
   "Opgeslagen" op het "Training voltooid"-scherm.
   Live geverifieerd: een verbeterde prestatie (meer reps, Goed) geeft
   `"Ging goed — volgende keer proberen we 14 reps."`; een eerste keer
   op een oefening (geen historie) geeft `"Volgende keer hetzelfde — dat
   mag."` (KEEP).
5. (klaar) Progress-tab: mijlpalen en motivatie-signalen tonen, boven de
   bestaande sessielijst. `MotivationEngineService.getStatus()` (bron:
   `MILESTONES`-constante, nu geëxporteerd i.p.v. alleen intern) geeft nu
   ook `milestonesReached: number[]` en `nextMilestone: number | null`
   terug — pure afgeleide feiten, geen nieuwe beslissing. Nieuwe
   `AiCoachService.explainMotivationStatus()` vertaalt het huidige
   motivatiesignaal (RETURN_AFTER_ABSENCE/MILESTONE_REACHED/
   CONSISTENCY_GOOD/AT_RISK_OF_DROPOUT/CONSISTENCY_DECLINING/NORMAL) naar
   een Nederlandse zin — nooit als falen verwoord, ook niet bij
   AT_RISK_OF_DROPOUT/CONSISTENCY_DECLINING (v2.16.18). `MotivationEngine
   Controller` (nu met `AiCoachModule` erbij) voegt dit samen tot
   `GET /motivation/status` → `{ ...status, coachMessage }`, zelfde patroon
   als de bestaande coachMessage op andere endpoints.
   Progress-tab toont dit nu als twee kaarten boven de sessielijst: een
   motivatie-kaart (de coachMessage-zin) en een mijlpalen-kaart (chips
   voor elke gehaalde mijlpaal + "eerstvolgende mijlpaal: N trainingen").
   Zelfde `isActive`-ververspatroon als de andere tabs.

Bewezen: alle 5 tabs (Home, Train, Progress, Nutrition-placeholder, Coach)
zijn bereikbaar via de onderste navigatiebalk; de Coach-tab toont de
AI Coach-berichten van vandaag en van eerdere sessies; Home toont de
consistency-streak en de recovery-status per spiergroep; na een training
zie je meteen per oefening wat de Progression Engine besliste; en Progress
toont naast de sessiegeschiedenis ook de gehaalde mijlpalen en het huidige
motivatiesignaal. Alle engine-uitkomsten uit Fase 3 zijn nu voor de
gebruiker zichtbaar, zonder dat de engines zelf iets anders zijn gaan
beslissen.

### FASE 5 — Nutrition (licht & ondersteunend)

Bron: "LOVTOFIT Blueprint v1.0-v1.4.docx" (v1.3) en
"LOVTOFIT Blueprint v2.16-v2.20.docx" (v2.17).
Principe: voeding ondersteunt, overheerst niet. Ranges i.p.v. exacte kcal,
trend boven dagweging, geen extreme doelen, geen medische claims. Eén stap
per keer.
1. (klaar) Gewicht bijhouden: `POST /body-measurements` (JWT-auth, DTO
   met sanity-check 20-400 kg) slaat elke meting op als een nieuwe rij in
   `body_measurements` — nooit een update, zodat de geschiedenis bewaard
   blijft (CLAUDE.md-datamodelregel). Vervangt de Nutrition-placeholder
   (`PlaceholderTabScreen` verwijderd, was daarna nergens anders meer
   gebruikt). Nutrition-tab toont een simpel formulier (gewicht invoeren →
   "Gewicht opslaan" → bevestiging).
2. (klaar) Gewichtstrend (bron: blueprint v2.17.4/v2.17.12): een simpele
   Trend Engine v1 (`BodyMeasurementsService.getTrend()`) vergelijkt het
   gemiddelde van de oudste en de recentste helft van de metingen — bij
   minder dan 3 metingen `INSUFFICIENT_DATA` i.p.v. een verzonnen trend
   ("begin simpel" — later evt. datumvenster i.p.v. aantal-gebaseerde
   helften, zoals de Recovery Engine al doet). Nieuwe
   `AiCoachService.explainWeightTrend()` vertaalt DOWN/UP/STABLE naar
   dezelfde geruststellende toon als het blueprint-voorbeeld ("je gewicht
   schommelt van dag tot dag, maar de trend beweegt geleidelijk..."), nooit
   als prestatie-oordeel. `GET /body-measurements` geeft dit terug
   (status, richting, aantal metingen, geschiedenis, coachMessage).
   Nutrition-tab toont dit als een kaart boven het logformulier (met
   trend-icoon) — het formulier blijft altijd meteen bruikbaar, ook terwijl
   de trend nog laadt of niet op te halen is. Ververst automatisch na het
   opslaan van een nieuwe meting, en bij het terugkeren naar de tab
   (zelfde `isActive`-patroon als de andere tabs).
   Live geverifieerd: 1 meting → `INSUFFICIENT_DATA`; na 3 dalende
   metingen (82.4 → 81.8 → 81.2) → `DOWN` met de verwachte tekst.
3. (klaar) Water-tracking (bron: blueprint v1.3 §10 / v2.17.7): nieuw
   `WaterIntake`-model (`water_intake`-tabel) — net als bij gewicht is elke
   registratie een losse rij, "vandaag" is simpelweg de som van de rijen
   van vandaag (kalenderdag in UTC). `POST /water-intake` logt een
   hoeveelheid (DTO-check 1-3000 ml). Het waterdoel is een praktische
   richtwaarde (geen medische norm): 30 ml/kg op basis van het laatst
   bekende gewicht (`body_measurements`), afgerond op een glas (250 ml);
   zonder bekend gewicht een vast standaarddoel van 2000 ml.
   `GET /water-intake/today` geeft `{ totalMl, targetMl, remainingMl,
   coachMessage }` terug — `AiCoachService.explainWaterStatus()` gebruikt
   dezelfde formulering als het blueprint-voorbeeld ("nog ongeveer 500 ml
   te gaan"), rondt naar boven af (geen schijnprecisie) en viert het
   gehaalde doel zonder schuldgevoel-taal bij het niet halen ervan.
   Nutrition-tab toont dit als een kaart bovenaan (vóór de gewichtstrend)
   met twee één-tik-knoppen ("+250 ml"/"+500 ml") die altijd bruikbaar
   blijven, ook terwijl de stand nog laadt.
   Live geverifieerd: 0 ml → "nog ongeveer 2500 ml te gaan" (doel 2500 ml
   bij 81,2 kg); na +250 ml en +500 ml → 750 ml geregistreerd, doel
   ongewijzigd, restant correct bijgewerkt.
4. (klaar) Caloriedoel als range, alleen bij een gewichtsdoel (bron:
   blueprint v1.3 §3/§4 + v2.17.16 pseudocode). Nieuwe `CalorieGoalService`
   (geen nieuwe tabel — leest het bestaande actieve doel + het laatst
   bekende gewicht): alleen bij een actief `LOSE_WEIGHT`- of
   `BUILD_MUSCLE`-doel wordt er iets berekend (`NOT_APPLICABLE` voor
   GET_STRONGER/IMPROVE_CONDITION/GET_FIT of geen doel — "geen agressieve
   calorie-aanpassing" zonder gewichtsdoel); zonder een gelogd gewicht
   `LIMITED_ESTIMATE` (bron: v2.17.12) i.p.v. iets verzinnen. Richtwaarde is
   bewust simpel (~30 kcal/kg, ±10% range, ±15%/+10% richting bij
   afvallen/opbouwen) — geen Mifflin-St Jeor-achtige BMR-formule, want die
   heeft lengte/leeftijd nodig die we nog niet verzamelen; zelfde soort
   vuistregel als de waterformule uit stap 3. `AiCoachService.
   explainCalorieGoal()` presenteert dit altijd als range, nooit als één
   getal (v1.3 §4). `GET /calorie-goal` (JWT-auth). Nutrition-tab toont dit
   als kaart tussen de gewichtstrend en het logformulier — onzichtbaar bij
   `NOT_APPLICABLE` ("alleen bij een gewichtsdoel").
   **Bewuste vereenvoudiging, expliciet niet (nog) gebouwd:** de blueprint
   noemt calorie-range een PREMIUM-only functie (v1.3 §7 / v2.17.9), maar
   er bestaat nog geen premium/`FeatureAccessService`-infrastructuur in dit
   project (geen `User.isPremium`, geen betaalflow). Deze stap gaat daarom
   voorlopig gewoon voor iedereen — een aparte, bewust geplande stap moet
   `FeatureAccessService` (`CAN_USE_*`) invoeren zodra premium een
   onderwerp wordt, i.p.v. het er nu stiekem bij te bouwen.
   Live geverifieerd: LOSE_WEIGHT + 81,2 kg → 1850–2300 kcal; alleen
   GET_STRONGER → `NOT_APPLICABLE`.
   **Bugfix onderweg ontdekt (niet in de code, in de test-workflow):** de
   kaart leek na het bouwen niet te verschijnen voor een echt account met
   een actief afvaldoel + gelogd gewicht. Een rechtstreekse test van
   `CalorieGoalService` tegen de database (buiten de API om) bevestigde dat
   de backend al correct `HAS_RANGE` teruggaf; de oorzaak lag in een
   verouderde incognito-browsercache — meerdere "nieuwe" incognitovensters
   waren na elkaar geopend zonder de vorige ooit te sluiten, waardoor Chrome
   dezelfde (verouderde) incognito-sessiecache bleef hergebruiken. Opgelost
   door eerst alle Chrome-processen af te sluiten vóór een nieuw
   incognitovenster te openen (vastgelegd in het geheugenbestand
   `feedback_flutter_web_browser_cache.md` voor toekomstige stappen).

Bewezen: alle vier stappen werken samen in de Nutrition-tab — gewicht
loggen (met geschiedenis, nooit overschreven), een gewichtstrend die nooit
één losse meting overinterpreteert, waterregistratie met een praktische
richtwaarde en een caloriedoel als range dat alleen verschijnt bij een
echt gewichtsdoel. Eiwit-richtwaarde en voedingsvoorkeuren (blueprint v1.3
§9/§15, v2.17.6/v2.17.8) zijn bewust niet gebouwd — buiten de scope die
voor deze fase is goedgekeurd; een latere fase kan die er gestructureerd
bij zetten, mét de nog te bouwen `FeatureAccessService` voor premium-
onderdelen zoals de blueprint die aangeeft.

### FASE 6 — Premium / Feature Access (zonder echte betalingen)

Bron: blueprint v1.1 (Free vs Premium), v1.5 §13, v2.19 (Feature Access,
pseudocode v2.19.18, test lab v2.19.21) en v2.25.28/v2.25.29 (datamodel).
Afgesproken scope: **geen echte betaalprovider** (App Store/Google Play/
RevenueCat/prijs — blueprint v1.1.22/v2.37.20: "nog NIET beslissen"), en
**alleen de caloriedoel-range gaat achter Premium** — niets wat nu gratis
werkt wordt weggehaald (v1.1.15/v2.19.4). Eén stap per keer.
1. (klaar) Datamodel + `FeatureAccessService` (alleen backend). Nieuwe
   tabellen `subscriptions` (plan FREE/PREMIUM, status TRIAL/ACTIVE/
   CANCELLED/EXPIRED, `startedAt`, `expiresAt`; meerdere rijen per gebruiker
   toegestaan zodat historie bewaard blijft, de nieuwste telt; geen rij =
   FREE), `features` (`featureKey` uniek, `active` = globale aan/uit,
   FA-011) en `plan_features` (plan × feature → enabled). Migratie
   `add_subscriptions_and_features`. De functielijst staat centraal in
   `src/feature-access/feature-keys.ts` (`FEATURES`, bron voor de seed):
   FREE+PREMIUM = BASIC_WORKOUT, HISTORY, COACH_MESSAGES, WEIGHT_TRACKING,
   WATER_TRACKING; alleen PREMIUM = CALORIE_RANGE (+ alvast
   DYNAMIC_PLANNER, SMART_RESCHEDULE, QUICK_SESSION, ADVANCED_PROGRESS,
   WEEKLY_COACH_REVIEW, die als functie nog niet bestaan).
   `FeatureAccessService.canUse(userId, featureKey)` /
   `getEffectivePlan(userId)`: ACTIVE geldig tot `expiresAt` (of zonder
   einddatum); TRIAL/CANCELLED alleen tot `expiresAt` (zonder einddatum
   géén toegang — nooit stilletjes permanent Premium); EXPIRED of een
   verstreken `expiresAt` → FREE, zonder dat er een achtergrondtaak de
   status hoeft om te zetten. Onbekende/uitgeschakelde functie → dicht.
   Leest alleen, verwijdert nooit data (v2.19.10). Unit-tests volgen
   FA-001…FA-013.
   Let op: Prisma 7 genereert de client niet meer automatisch bij
   `migrate dev` — daarna ook `npx prisma generate --config
   prisma7.config.ts` draaien.
   Live geverifieerd (tijdelijke testgebruiker, daarna opgeruimd): geen
   abonnement → FREE (water ja, calorie-range nee); TRIAL nog 7 dagen →
   PREMIUM (beide ja); nieuwere EXPIRED-rij → weer FREE, beide rijen
   bewaard.
2. (klaar) `GET /features` (JWT-auth, `FeatureAccessController`) →
   `{ plan, features: { CAN_USE_*: boolean } }` (v2.19.7), via
   `FeatureAccessService.getFeatureAccess()` — zelfde regels als `canUse`
   (gedeelde `isEnabledFor`), 2 queries i.p.v. één per functie. Bevat altijd
   elke sleutel uit `FEATURES` (niet-geseed → false). Puur informatie voor
   de UI: de backend checkt elke Premium-aanvraag zelf opnieuw via `canUse`
   (v2.19.8). Let op: bij PREMIUM staan ook nog-niet-bestaande functies
   (bv. `CAN_USE_QUICK_SESSION`) op true — de app mag die vlaggen pas
   gebruiken zodra de functie echt bestaat.
   Live geverifieerd: zonder token 401; FREE → 5 gratis functies true,
   CALORIE_RANGE false; na een TRIAL-rij → plan PREMIUM, alles true.
3. (klaar) Caloriedoel-range achter Premium (backend). `CalorieGoalService.
   getStatus()` vraagt — ná de doel-check — `FeatureAccessService.canUse(
   userId, 'CAN_USE_CALORIE_RANGE')`; zonder toegang nieuwe status
   `PREMIUM_REQUIRED` (goalType wel, range `null` — de range verlaat de
   server niet, v2.19.22). Zonder gewichtsdoel blijft het `NOT_APPLICABLE`
   (geen upsell zonder behoefte, v2.19.14). `AiCoachService.
   explainCalorieGoal()` geeft bij `PREMIUM_REQUIRED` een uitleg zonder
   "geweigerd"-taal die benadrukt wat gratis blijft (v2.19.13). Water/
   gewicht/gewichtstrend ongewijzigd gratis.
   Live geverifieerd: FREE + afvaldoel → `PREMIUM_REQUIRED`; TRIAL →
   `HAS_RANGE` 1850–2300 kcal; nieuwere EXPIRED-rij → weer
   `PREMIUM_REQUIRED`, gewichtsmeting bewaard; FREE + alleen GET_STRONGER →
   `NOT_APPLICABLE`.
4. (klaar) Vergrendelde teaser in de Nutrition-tab. Nieuwe herbruikbare
   `PremiumTeaserCard` (`lib/widgets/premium_teaser_card.dart`): icoon,
   titel, 🔒 Premium-label, de uitleg uit de backend (coachMessage) en een
   rustige (outlined) "Ontdek Premium"-knop (v2.19.13). Die opent
   `showPremiumInfoSheet()` (bottom sheet): "Jij traint. Wij denken mee."
   (v1.1.21), alleen wat Premium nú echt doet (caloriedoel als range —
   geen beloftes over nog niet bestaande functies) en dat trainingen/
   geschiedenis/gewicht/water altijd gratis blijven. Nutrition-tab toont
   de teaser puur op basis van de backend-status `PREMIUM_REQUIRED` van
   `GET /calorie-goal` — de app beslist niets zelf.
5. (klaar) Premium activeren zonder echte betaling: proefperiode van 7
   dagen (v2.19.12). Backend: `POST /subscriptions/trial` (JWT-auth,
   nieuwe module `src/subscriptions/`, `SubscriptionsService.startTrial()`)
   maakt een nieuwe `subscriptions`-rij PREMIUM/TRIAL met `expiresAt` = nu
   + 7 dagen. Eén proefperiode per gebruiker, ooit: wie al eens een
   PREMIUM-rij had (trial of betaald) krijgt 409 "Je hebt de gratis
   proefperiode al gebruikt." Check + aanmaken in één Serializable-
   transactie (dubbel tikken → nooit twee trials). Deze module bepaalt
   géén toegang — dat blijft uitsluitend de `FeatureAccessService`; na
   afloop valt de gebruiker vanzelf terug naar FREE, data blijft bewaard.
   App: `showPremiumInfoSheet()` heeft nu de hoofdknop "Probeer 7 dagen
   gratis" + "Niet nu" ("er wordt niets afgeschreven"). Bij succes sluit
   het paneel, roept `PremiumTeaserCard.onPremiumActivated` aan (Nutrition
   herlaadt `GET /calorie-goal` → range zichtbaar) en toont een SnackBar
   met de einddatum ("daarna ga je gewoon terug naar Free — je gegevens
   blijven bewaard"). Fouten (409-tekst/geen verbinding) in het paneel.
   Bugfix onderweg: het paneel werd hoger dan de standaard bottom-sheet-
   hoogte (~half scherm) → "Niet nu" viel buiten beeld op kleine
   schermen; nu `isScrollControlled: true` + `SingleChildScrollView`.
   Live geverifieerd: zonder token 401; vóór trial `PREMIUM_REQUIRED`;
   trial → 201 (einddatum +7 dagen); daarna `HAS_RANGE` 1850–2300 kcal en
   `/features` plan PREMIUM; tweede poging → 409. In de app: trial starten
   ontgrendelt de caloriekaart direct.
   **Bewust niet gebouwd:** de melding "je proefperiode loopt binnenkort
   af" (v2.19.12 — heeft een plek nodig, bv. Home of notificaties), een
   echte betaalprovider/prijs (afgesproken buiten scope), audit logging
   van feature-gebruik (v2.19.20, optioneel), en het vergrendelen van nog
   niet bestaande Premium-functies (Quick Session, Smart Reschedule, enz.
   staan al in `FEATURES`, maar moeten nog gebouwd worden).

Bewezen: Premium is één centrale regel (`FeatureAccessService`, `CAN_USE_*`)
op basis van een abonnement-historie die nooit overschreven wordt; de
backend beslist en de app toont alleen wat de backend besliste (de
caloriedoel-range verlaat de server niet zonder toegang). Een FREE-
gebruiker met een gewichtsdoel ziet een vergrendelde, niet-opdringerige
teaser, kan zonder betaling 7 dagen Premium proberen, ziet de range dan
meteen, en valt na afloop vanzelf terug naar FREE zonder dataverlies.
Niets wat vóór deze fase gratis werkte is weggehaald.

### FASE 7 — Quick Session (premium)
Doel: bij tijdgebrek een ingekorte, slimme training binnen de beschikbare tijd. Premium-functie (CAN_USE_QUICK_SESSION). Eén stap per keer.
1. Backend: Quick Session-logica — genereer een verkorte workout die binnen X minuten past, belangrijkste oefeningen (compound/prioriteit) eerst, langs de Rule Guard.
2. Achter Premium via de FeatureAccessService (CAN_USE_QUICK_SESSION); Free ziet een teaser.
3. Flutter: knop/optie "Weinig tijd? Quick Session" op de Train-tab, met tijdkeuze.
4. Free: vergrendelde teaser (🔒 Premium), net als bij het caloriedoel.

Voortgang Fase 7:
1. (klaar) Quick Session-logica (backend). Bron: blueprint v0.6 §9 (QUICK =
   belangrijkste compound → tegenovergestelde beweging → benen →
   core), v0.7.10 ("dezelfde trainingslogica, maar compacter", 3–4
   bewegingen, beperkte rust), v2.5.4 (tijd = harde grens: minder
   oefeningen of sets tot het past), v2.0 test 03 (minimale
   uitvoerbaarheid), v0.8.11 (Quick Session ≠ mislukte training, mag
   progressie niet verstoren). `GET /workouts/quick-session?minutes=10|15|20` (later teruggebracht naar
   10|15, zie stap 3)
   (JWT-auth; alleen die drie keuzes — boven ~15 min zit het maximum van 4
   bewegingen al vol, wie meer tijd heeft doet de normale training).
   `DecisionEngineService.getQuickSession()` gebruikt exact dezelfde
   beslisladder als `/workouts/today` (gedeelde `selectWorkout()`: niveau,
   apparatuur, REPLACE-uitsluiting, herstel, progressie) en kort daarna in
   met de pure functie `planQuickSession()`: prioriteit SQUAT → PUSH → PULL
   → CORE_STABILITY → HINGE (…), een patroon op RECOVERY schuift naar
   achteren (valt bij weinig tijd als eerste af); max. 4 oefeningen, liever
   meer bewegingen × 2 sets dan minder × 3, nooit onder 2 sets; rust 30 s
   i.p.v. 45 s. Reps blijven die van de progressiebeslissing (de
   Progression Engine vergelijkt gemiddelden per set, dus minder sets telt
   niet als achteruitgang). Rule Guard: nieuwe optionele `timeLimit` in de
   context → RG04 is voor een Quick Session een harde violation (exact in
   seconden vergeleken); bij een normale training blijft het een
   waarschuwing (tekst nu "een Quick Session kan helpen"). Eén gedeelde
   tijdschatting `estimateWorkoutSeconds()` (rule-guard.service.ts) voor
   inkorten én controleren. Response = TodaysWorkout + `sessionType:
   'QUICK'`, `availableMinutes`, `estimatedMinutes`, `restSeconds`, en
   `AiCoachService.explainQuickSession()` ("Een korte training telt gewoon
   mee."; pijn-vervanging wordt ook uitgelegd).
   Live geverifieerd (beginner, thuis, geen materiaal): normaal 5×3 ~21
   min; Quick 10 min → squat/push/pull/core × 2 sets (~10 min); Quick 15
   → zelfde 4 × 3 sets (~14 min); ongeldige minuten → 400.
2. (klaar) Quick Session achter Premium (backend). Keuze beperkt tot
   10/15/20 min (`QUICK_SESSION_MINUTE_OPTIONS`, `@IsIn` in de DTO; andere
   waarden → 400). De check zit in `DecisionEngineService.getQuickSession()`
   zelf, vóór er iets berekend wordt: zonder `CAN_USE_QUICK_SESSION` →
   `{ status: 'PREMIUM_REQUIRED', coachMessage }` (geen workout, zelfde
   patroon als het caloriedoel); met toegang → de volledige Quick Session
   met `status: 'AVAILABLE'`. Opslaan checkt geen Premium, dus een Quick
   Session loopt door als Premium tijdens de training verloopt (v2.19.11).
   `AiCoachService.explainQuickSessionLocked()`: waarde uitleggen + "Je
   normale training blijft gewoon gratis" (v1.1.16/v2.19.13).
   `/workouts/today` ongewijzigd gratis.
   Live geverifieerd: FREE → `PREMIUM_REQUIRED`, normale training werkt;
   na proefperiode → `AVAILABLE` (10 min 4×2, 15 min 4×3). 15 en 20 min
   geven dezelfde ~14 min-training → de app toont alleen 10 en 15 min.
3. (klaar) Flutter: Quick Session op de Train-tab. Onder de hoofdactie
   START TRAINING een rustige tweede knop "⚡ Weinig tijd? Quick Session" →
   bottom sheet "Hoeveel tijd heb je vandaag?" met alleen **10 en 15 min**
   (bij 20 min zat de Quick Session al op zijn maximum = dezelfde training
   als 15 min; de backend-lijst `QUICK_SESSION_MINUTE_OPTIONS` is daarop
   ook teruggebracht naar [10, 15] — één consistente lijst, 20 → 400).
   Bij `AVAILABLE` vervangt een Quick Session-kaart tijdelijk de normale
   kaart ("QUICK SESSION · ~N MIN", coachMessage, oefeningen met
   sets×reps, START QUICK SESSION, "Terug naar je normale training").
   `WorkoutScreen` heeft nu een optionele `restSeconds` (standaard 45; de
   Quick Session geeft 30 mee van de backend). Opslaan ongewijzigd.
   Live geverifieerd in de app: Quick Session 10 min → 4 oefeningen × 2
   sets, rusttimer start op 00:30, terug naar normaal werkt.
4. (klaar) Free: vergrendelde teaser voor Quick Session. Bij
   `PREMIUM_REQUIRED` (na de tijdkeuze — de teaser verschijnt pas als de
   gebruiker er echt om vraagt, v1.1.16) vervangt dezelfde
   `PremiumTeaserCard` als bij het caloriedoel (⚡, "Quick Session", 🔒
   Premium, backend-uitleg, "Ontdek Premium") de Quick Session-knop, onder
   de normale training die gewoon bruikbaar blijft. Na "Probeer 7 dagen
   gratis" haalt de Train-tab direct de Quick Session op met de al gekozen
   tijd (`_lastQuickSessionMinutes`). Het Premium-paneel noemt nu beide
   echte Premium-functies (Quick Session + persoonlijk caloriedoel). De
   Train-tab is scrollbaar geworden (met de teaser erbij paste het niet
   altijd meer op een klein scherm).
   Live geverifieerd in de app: nieuw FREE-account → teaser na tijdkeuze,
   normale training blijft werken; proefperiode starten → Quick Session
   van 10 min verschijnt direct. Backend: 20 min → 400.

Bewezen: een Premium-gebruiker met weinig tijd kiest op de Train-tab 10 of
15 minuten en krijgt een ingekorte training met dezelfde veiligheids- en
progressielogica als de normale training (belangrijkste bewegingen eerst,
herstellend patroon valt als eerste af, nooit onder 2 sets, kortere rust),
die door de Rule Guard met de tijd als harde grens wordt gecontroleerd en
de progressie niet verstoort. Een FREE-gebruiker ziet op dat moment een
rustige vergrendelde teaser en kan via de proefperiode direct verder; de
normale training blijft altijd gratis. Eén consistente lijst van
tijdkeuzes (10/15) in backend en app.

### FASE 8 — Energie check-in (modifier)
Doel: bij het starten van een training vraagt de app kort de energie/gesteldheid, en past de training licht aan. Het is een modifier bovenop de bestaande engines — het overrulet nooit de veiligheid of de Rule Guard. Eén stap per keer.
1. Backend: energie-input (bv. Laag / Normaal / Hoog) opslaan bij de sessie, en de training licht aanpassen (bv. lage energie → minder volume/lichtere variant; hoge energie → normaal of iets meer). Altijd binnen de Rule Guard.
2. Flutter: één snel keuzescherm "Hoe voel je je vandaag?" vóór de training start (overslaan mag).
3. De aanpassing zichtbaar maken ("Aangepast aan je energie vandaag").
Regel: licht houden, geen dagboek; de energie-check is optioneel.

Voortgang Fase 8:
1. (klaar) Backend: energie-check + Light Session. Bron: blueprint v0.7.11
   / v0.9.11 (😄 Goed / 😐 Normaal / 😴 Weinig energie → Light Session),
   v0.6 §10 (3×12 → 2×10, langere rust, eenvoudige oefeningen), v1.9 #23,
   v2.0 test 08, v2.4.5 ("Light Session ≠ slechte training"), v2.0 §13
   (`energy_feedback` bij de sessie). Nieuwe enum `EnergyLevel`
   (LOW/NORMAL/HIGH) + nullable `WorkoutSession.energyLevel` (null =
   overgeslagen; migratie `add_session_energy_level`).
   `GET /workouts/today?energy=LOW|NORMAL|HIGH` (optioneel): alleen LOW
   past aan via de pure functie `applyLightSession()` (max. 2 sets, reps
   −2 met ondergrens 6, 60 s rust i.p.v. 45) + `preferLightestVariant` in
   de scoring (lichtste variant voor elk patroon); géén oefeningen
   weggelaten. Modifier bovenop dezelfde beslisladder (pijn-uitsluiting
   blijft), daarna de Rule Guard (nieuwe optionele `restSeconds` in de
   context voor de RG04-schatting). Response + `energyLevel`,
   `energyAdjusted`, `restSeconds`. `POST /workouts/sessions` accepteert
   en bewaart `energyLevel`. Progression Engine: een Light Session slaat
   géén nieuwe beslissing op (neemt de vorige over, zodat bv. een eerdere
   INCREASE blijft staan — v0.8.11-principe) en een normale training
   vergelijkt nooit met een Light Session (history-query: `energyLevel`
   null OF niet LOW — expliciete OR, want `not: LOW` sluit in SQL ook
   null uit); pijn/ongemak (REPLACE) wordt altijd opgeslagen.
   `AiCoachService.explainTodaysWorkout()` kreeg `isLowEnergy` ("…maken we
   het wat lichter… Ook een lichte training telt mee.").
   Afspraken: hoge energie = normale training (geen extra volume — staat
   niet in de blueprint, de Progression Engine bepaalt wanneer er meer
   bij kan); Quick Session negeert de energie-check (die is zelf al de
   "korte training"-optie, v1.9 §21); Light Session voorlopig **gratis**
   (blueprint noemt het Premium, v1.1.7/v1.1.19 — later eventueel via
   `FeatureAccessService`).
   Live geverifieerd: geen check/NORMAL/HIGH → 5×3×12, 45 s; LOW → 5×2×10,
   60 s, geen RG-waarschuwingen; Light Session opslaan → 0 progressie-
   rijen; normale training daarna (12 > 10 reps) → KEEP, geen onterechte
   INCREASE.

**Openstaand (losse stap ná Fase 8): coach-tekst bij vervangen oefening.**
Ontdekt tijdens Fase 8, stap 1. `hadRecentReplace` wordt afgeleid uit
`decisionByChosenExercise`, dat alleen de beslissing van de *gekozen*
oefening bevat. Daardoor verschijnt "…we hebben daarom een alternatief
gekozen" alleen als de pijnlijke oefening tóch gekozen werd (fallback
zonder alternatief) — precies omgekeerd — en blijft de uitleg weg bij een
echte vervanging. Zit er sinds Fase 3 stap 7 in; in Fase 7 overgenomen
in `getQuickSession()` (`explainQuickSession`). De oefeningkeuze zelf is
correct. Oplossing: per slot bijhouden of er een kandidaat met REPLACE is
uitgesloten, en de coach-tekst daarop baseren (RG09 blijft op de gekozen
oefening).
2. (klaar) Flutter: keuzescherm "Hoe voel je je vandaag?" (nieuw
   `lib/widgets/energy_check_sheet.dart`, `showEnergyCheckSheet()`): 😄
   Goed / 😐 Normaal / 😴 Weinig energie (labels v0.7.11 → HIGH/NORMAL/LOW)
   + "Overslaan", met één eerlijke zin ("Bij weinig energie maken we je
   training wat lichter."). START TRAINING op de Train-tab opent het eerst:
   bij een keuze haalt de app `GET /workouts/today?energy=…` opnieuw op (de
   backend beslist wat er verandert) en start daarmee; Overslaan start de
   al geladen training ongewijzigd; wegvegen = niet starten. Twee tikken
   van START tot trainen. Quick Session start zonder check (afspraak 2).
   `WorkoutScreen` kreeg `energyLevel` en stuurt die mee bij
   `POST /workouts/sessions`.
   Live geverifieerd op de telefoon: Weinig energie → 2 sets, 2 reps
   minder, rust 01:00; Overslaan → 3 sets, 00:45. In de database staat de
   energie bij de sessie (bv. `HIGH`, 15 sets); sessies van vóór Fase 8
   hebben `null`.
3. (klaar) De aanpassing zichtbaar: `WorkoutScreen` kreeg
   `energyAdjusted` (rechtstreeks uit de backend-response, de app beslist
   dit niet zelf) en toont dan bovenaan, de hele training lang, een rustige
   melding "🌿 Aangepast aan je energie vandaag — Minder sets, iets minder
   herhalingen en meer rust." (v2.4.5: lichter ≠ slechter). Geen melding
   bij Goed/Normaal/Overslaan/Quick Session.
   Live geverifieerd op de telefoon.

Bewezen: vóór een normale training vraagt de app in één tik "Hoe voel je
je vandaag?" (overslaan mag, geen dagboek). Bij weinig energie maakt de
backend er een Light Session van — zelfde veilige oefeningkeuze (pijn-
uitsluiting blijft), lichtste varianten, 2 sets, 2 reps minder, 60 s rust
— die door de Rule Guard gaat, zichtbaar is voor de gebruiker, bij de
sessie wordt opgeslagen, en de progressie niet verstoort (geen nieuwe
beslissing, nooit een vergelijkingspunt; pijn telt wel altijd). Goed/
Normaal = de normale training; Quick Session blijft zonder check.

### FASE 9 — Smart Reschedule (gemiste training)
Doel: als de gebruiker een geplande training mist, herplant de app die zonder schuldgevoel en zonder stapeling. Voor de doelgroep "de Afhaker". Eén stap per keer.
Principes: nooit bestraffend ("geen probleem, we pakken vandaag op"); nooit meerdere gemiste trainingen op één dag stapelen; blijft binnen de bestaande Decision/Recovery/Rule Guard-logica.

Voortgang Fase 9:
1. (klaar) Backend: gemiste training herkennen + slim herplannen. Bron:
   blueprint v0.2 §18, v0.3 §13, v0.7.12, v0.9.15, v1.1.8 (Premium),
   v1.4 §3-4, v1.9 §25, v2.16.6, v2.32.12. Er is nog geen opgeslagen
   dag-voor-dag planning: bewust gekozen voor een **standaardschema
   afgeleid uit `weeklyFrequency`** (2× ma/do, 3× ma/wo/vr, 4× ma/di/do/vr,
   5× ma/di/wo/vr/za, 6× ma-za), niets opgeslagen, geen migratie; zelf
   dagen kiezen kan later (vervangt enkel `DEFAULT_TRAINING_DAYS`).
   `GET /schedule/week` (JWT, module `src/schedule/`, pure functie
   `buildWeekSchedule()` in `week-schedule.ts`): kalenderweek ma-zo in
   Europe/Brussels (nog geen tijdzone per gebruiker). Gemist = vóór vandaag
   minder sessies dan voorbije geplande dagen (een dag later trainen is dus
   niet gemist; dagen vóór de onboarding tellen nooit mee, de eerste week
   krijgt een verlaagd weekdoel). Nooit stapelen: max. één training per
   dag, nooit boven het weekdoel; wat niet meer past valt weg
   (`droppedTrainings`, geen schuld). Herstel: nooit meer trainingsdagen na
   elkaar dan het eigen schema (ook over de weekgrens). Premium
   (`CAN_USE_SMART_RESCHEDULE`) herplant na een gemiste training (of als
   het standaardschema niet meer past) over alle resterende dagen, vandaag
   eerst → `smartReschedule: APPLIED`. Free houdt het standaardschema;
   `PREMIUM_REQUIRED` (teaser) alleen na een échte gemiste training. Rule
   Guard `checkSchedule()`: RG08 (niet boven het weekdoel, geen tweede
   training op een dag, niets in het verleden) + RG05 (herstelreeks) —
   hard, faalt luid. De training op een herplande dag zelf blijft
   gewoon `/workouts/today` (Decision Engine, recovery-aware). Tests o.a.
   een brute-force over alle frequenties × dagen × sessiecombinaties ×
   Free/Premium door de Rule Guard. Live geverifieerd: Free vs Premium na
   een gemiste maandag, eerste week, dag later getraind.
2. (klaar) Backend: vriendelijke coach-boodschap bij terugkomst. Bron:
   v0.2 §18 ("Geen probleem. We gaan verder. 💪"), v0.3 §13, v1.9 §25
   ("Je hoeft niets in te halen"; Free: volgende training staat klaar),
   v1.9 (teaser "zonder trainingen op elkaar te stapelen"), v2.37.12
   (lange afwezigheid → "Welkom terug 👋"). `AiCoachService.
   explainSchedule()` (templates, beslist niets) → `coachMessage` in
   `GET /schedule/week`, pas ná de Rule Guard. Premium: "Ik heb je week
   aangepast: je trainingen staan nu gepland voor vandaag, vrijdag en
   zondag. Je hoeft niets in te halen."; Free: "Je volgende training staat
   klaar voor …" + rustige teaser; alleen verschoven voor rust: "Ik heb je
   week wat verschoven…"; niets gemist/verschoven → `null`. Nooit het
   woord "gemist", geen aantallen, geen inhalen/schuld (getest). Live
   geverifieerd (Free/Premium/niets gemist).
3. (klaar) Flutter: de reschedule-boodschap op Home. Home haalt ook
   `GET /schedule/week` op en toont bovenaan de kaart "Je week" met de
   `coachMessage` — alleen als er iets te melden is. Free: dezelfde tekst in
   een rustige `PremiumTeaserCard` ("Ontdek Premium"; na de proefperiode
   laadt Home opnieuw en staat de aangepaste week er meteen). Het Premium-
   infoblad noemt nu ook Smart Reschedule. Laadt de weekplanning niet, dan
   werkt Home gewoon verder zonder kaart. Getest op de telefoon (CPH2247)
   met een account dat maandag oversloeg.
   **Bugfix "Deze week: 30 van de 2":** geen rekenfout — het account had
   echt 30 (test)trainingen deze week — maar (a) "X van de Y" werd onzin
   boven het doel en (b) de consistentie-kaart telde de laatste 7 dagen
   (Motivation Engine) terwijl de weekplanning en "Je week" de kalenderweek
   ma-zo gebruiken. Nu: "Deze week" op Home = `completedThisWeek`/
   `weeklyTarget` van `/schedule/week` (terugval op Motivation als die niet
   laadt), en op/boven het doel "Deze week: weekdoel gehaald ✓ (30
   trainingen, doel 2)". Streak en motivatiesignalen blijven bewust de
   laatste 7 dagen gebruiken. Nagerekend in SQL (kalenderweek in
   Europe/Brussels) voor drie accounts: telling klopt. Widget-tests met een
   nagebootste backend (`http.runWithClient` + `MockClient`).

Bewezen: slaat de gebruiker een geplande training over, dan krijgt hij op
Home geen verwijt maar "Geen probleem, we gaan gewoon verder. 💪". Premium
herplant de rest van de week — vandaag eerst, nooit twee trainingen op één
dag, nooit boven het weekdoel, nooit meer dagen na elkaar dan het eigen
schema — gecontroleerd door de Rule Guard (RG08/RG05); wat niet meer past
valt weg zonder schuld ("Je hoeft niets in te halen"). Free houdt het
standaardschema ("je volgende training staat klaar") met een rustige
teaser, alleen na een échte gemiste training. "Deze week" betekent op Home
overal dezelfde kalenderweek.

## Oefeningenbibliotheek & foto's (lopend)
Doel: de oefening-foto's (frontend/assets/exercises/, 26 oefeningen × man/
vrouw/duo) in de app tonen. In stappen.
1. (klaar) Foto's verkleind: 78 PNG (157 MB) → WebP 800 px breed, kwaliteit
   82 (2,5 MB), bestandsnamen gelijk (`lovtofit_<oefening>_<man|vrouw|
   duo>.webp`). Originele PNG's staan buiten de repo in
   `C:\projects\lovtofit-originals\exercises\`.
2. (klaar) 15 nieuwe oefeningen (seed, herhaalbaar) → 35 in totaal. Cardio:
   Burpees, High Knees, Mountain Climbers, Stair Climbs, Treadmill
   Intervals, Running Intervals, Sprints; core: Bicycle Crunches (ROTATION),
   Superman (rug, CORE_STABILITY); Wall Sit (SQUAT); mobiliteit: Cat-Cow,
   Downward Dog, Hip Circles, Standing Forward Fold, World's Greatest
   Stretch. Indeling volgens blueprint v0.5. Migratie
   `add_treadmill_and_outdoor`: materiaal `TREADMILL` (alleen met FULL_GYM,
   alleen op locatie GYM/BOTH), veld `Exercise.location` (ANYWHERE/OUTDOOR)
   en trainingslocatie `OUTDOOR`. Regels in de Decision Engine (filter) én
   de Rule Guard (RG02): gym-apparaten alleen GYM/BOTH, buitenoefeningen
   alleen OUTDOOR, wie buiten traint krijgt geen gym-apparaten.
3. (klaar) Foto's gekoppeld. Vaste koppeling in de seed: `Exercise.imageKey`
   (migratie `add_exercise_image_key`), bv. Bodyweight Squat = `squats`;
   24 van de 35 oefeningen hebben een foto. De API geeft `imageKey` mee in
   de workout-slots. App: widget `ExercisePhoto`
   (`lib/widgets/exercise_photo.dart`) toont
   `assets/exercises/lovtofit_<imageKey>_duo.webp` (variant in één
   constante `exercisePhotoVariant`, duo = standaard), anders een
   placeholder (halter-icoon, "Foto volgt binnenkort"; ook bij een
   ontbrekend bestand). Groot in het workout-scherm (max. 160 hoog, zodat
   "SET KLAAR" ook op 360×640 zonder scrollen in beeld blijft — getest),
   klein naast elke oefening op de Train-tab (ook Quick Session). Bewust
   nog zonder foto: Reverse/Walking Lunge (foto toont een stilstaande
   lunge) en Dumbbell Chest Press (foto toont een halterstang). Getest op
   de telefoon.

## Openstaande punten (later oppakken)
1. **Cardio en mobiliteit worden nog niet ingepland.** Het enige template
   heeft alleen de slots SQUAT, PUSH, PULL, HINGE en CORE_STABILITY, dus de
   cardio-oefeningen, de 5 mobiliteitsoefeningen en Bicycle Crunches
   (ROTATION) worden nooit gekozen. Nodig: een warming-up/cooldown of een
   cardio-blok in de templates (blueprint v0.5 §8-9, v0.6).
2. **"Buiten" is nog niet kiesbaar.** De backend kent trainingslocatie
   `OUTDOOR`, maar de onboarding (`frontend/lib/onboarding_flow.dart`)
   biedt alleen Thuis/Fitness/Beide. Running Intervals en Sprints krijgt
   dus nog niemand. Nodig: een keuze "🌳 Buiten" in onboarding/instellingen
   (of een "vandaag train ik buiten"-optie).
3. **Oefeningen op tijd bestaan nog niet.** Plank, Side Plank, Wall Sit en
   de intervallen zijn eigenlijk op tijd (seconden, of werk/rust × rondes,
   blueprint v0.5 §8), maar de app kent alleen sets × reps (6-20, RG06).
   Nodig: een oefeningtype "tijd" in datamodel, Decision Engine, Rule Guard
   en het workout-scherm.
4. **Engine-filtering veranderd bij Thuis + "volledige gym".** Een
   gebruiker met locatie HOME (of OUTDOOR) die FULL_GYM als materiaal
   aanvinkt, krijgt nu nooit meer kabel-/machine-oefeningen of de
   loopband: de Decision Engine filtert ze vooraf weg (vroeger kon de
   engine er één kiezen en blokkeerde de Rule Guard daarna de hele
   workout). Nog te bevestigen of dit het gewenste gedrag is, en of de
   onboarding die combinatie nog moet toelaten.
