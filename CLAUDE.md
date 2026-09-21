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

## Huidige fase: FASE 0 — Walking skeleton

Doel: bewijs dat de hele keten werkt met bijna niks erin.
1. Projectstructuur (backend + frontend) + Git.
2. PostgreSQL lokaal (Docker).
3. NestJS-backend + Prisma verbonden + 1 migratie.
4. Eén endpoint `GET /health` → `{ "status": "ok" }`.
5. Flutter-app met één scherm dat `/health` aanroept en "verbonden" toont.

Klaar wanneer: het Flutter-scherm data uit onze eigen backend + database toont.
