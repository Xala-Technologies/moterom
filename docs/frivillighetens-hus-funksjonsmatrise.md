# Frivillighetens Hus — funksjonsmatrise

Dato: 13. oktober 2026.
Kilder: møtereferat `Motereferat_Frivillighetens_Hus_Digilist_13-10-2026.pdf` og kravspesifikasjon `Spek fra Ingvild - KFUK-KFUM.pdf`.
Sammenholdt mot Møterom slik det er implementert i dette repoet, og mot Digilist-kontraktene i `docs/digilist-integration.md`.

Dette er et internt grunnlag for neste kundemøte og tilbud. Det er ikke et tilbud, en avtale eller en bekreftet leveranseliste.

## Slik leses matrisen

En rad kan ha mer enn ett kryss. Kolonnene betyr:

| Kolonne             | Betydning                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Eksisterer          | Fungerer i Møterom i dag, med Digilist som bookingfasit. Kan brukes etter tenant-oppsett.                       |
| Tilpasning          | Kjernen finnes. Trenger nytt romregister, regler, roller, merkevare eller at vi åpner noe Møterom i dag nekter. |
| Ny utvikling        | Nytt produktområde i Møterom og/eller Digilist-motoren. Ikke en konfigurasjonsjobb.                             |
| Ekstern avhengighet | Kunden, Digilist-plattformen eller en tredjepart må levere data, API, avtale eller godkjenning.                 |

Møterom er i dag en **privat, innlogget portal for ett bygg** (SKB). Bookinger er **gratis**. Betalte tilbud avvises i BFF. Catering, adgangskontroll, faktura, e-postkvittering og PowerOffice er utenfor dagens implementasjon. Det skal ikke loves.

## Kort konklusjon

Kunden vil ha den dedikerte møteromsvisningen, ikke en bred administrasjonsplattform. Det treffer Møterom.

Det som allerede er sterkt nok til å starte en visuell og operativ pilot:

- innlogget booking av ett rom
- mobil flate, kalender, godkjenning per rom
- admin-oversikt, dag/7-dagers kalender, bookinger, blokkering
- tilgangsforespørsel og grunnleggende portalroller
- bookingmelding og notatfelt

Det som **må bygges** før Frivillighetens Hus kan kjøre huset sitt gjennom portalen uten manuell dobbeltarbeid:

- sone- og kombinasjonskonflikter (Sal 1–3, Bakgården)
- fire kundekategorier og styrt pris
- time / dag / kveld og billigste gyldige pris
- organisasjonsgodkjenning utover firmanavn
- kanselleringsfrist 5 / 30 dager med betalingsplikt
- betalt booking i selve portalen (Møterom nekter dette i dag)

Catering, Service Crew, infoskjerm, PowerOffice og Welcome Workdays hører hjemme etter kjernebookingen.

## Hva Møterom har i dag

Møterom er bygget for ett bygg, ett Digilist-tenant og innloggede medlemmer.

**Kunde**

- Finn rom med dato, tid og antall. Bare rom som er ledige hele intervallet vises.
- Innlogging med Digilist e-post-OTP og SMS-OTP.
- Tilgangsforespørsel med navn, e-post og firmanavn. Admin godkjenner.
- Bestilling: rom, tid, formål, notater, signert tilbud, bekreftelse.
- Rom kan kreve manuell godkjenning. Forespørsel er ikke bekreftet booking.
- Mine bookinger: avbestill, last ned kalenderfil, be om tidsendring. Opprinnelig reservasjon står til endringen er godkjent.
- Meldinger knyttet til bookingen.

**Admin**

- Dagssoversikt, dag- og 7-dagers romkalender, søk og statusfilter.
- Godkjenn / avslå, vedlikeholdsblokk, rominnhold, kapasitet, publisering.
- Brukere: Digilist-medlemmer, tilgangsinnboks, portalroller `member` / `operations` / `full`.
- Innsikt: belegg per rom, periode og firmanavn fra tilgangsforespørsel. Ingen omsetning, ingen CSV-eksport.

**Bevisst avgrenset**

- Ett rom per booking (kombinasjoner er egne romvarianter i FHH-demo; Digilist live sonegraf mangler).
- Betalte tilbud feiler lukket. Ingen faktura, kort, PowerOffice.
- Ingen catering, utstyrsreservasjon, infoskjerm, adgangskode eller automatisk e-post fra Møterom.
- `config/rooms.json` på denne branchen er Frivillighetens Hus (navn, ikke bekreftet kapasitet). SKB-katalogen ligger på `dev`/`main`.

## Rom som må bekreftes

De to kildene er ikke identiske. Ingvilds spek er mer presis. Møtereferatet bruker delvis andre navn. Kapasitet, utstyr, priser og bilder finnes ikke i disse dokumentene og skal ikke oppfinnes.

| Objekt                  | Ingvild                | Møtereferat                      | Merknad                                                                      |
| ----------------------- | ---------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Elvebredden             | Ja                     | Ja                               | Priseksempel i møtet: 400 / 560 / 800 kr per time. Tallene er illustrerende. |
| Biblioteket             | Ja                     | Ja                               |                                                                              |
| Salongen                | Ja                     | Ja                               |                                                                              |
| Spisestuen              | Ja                     | Ja                               |                                                                              |
| Styrerommet / Syerommet | Styrerommet            | Syerommet                        | Avklar navn.                                                                 |
| Sal 1, Sal 2, Sal 3     | Ja, som delbar Sal 1–3 | Ja                               | Kjerne for konflikter.                                                       |
| Sal 1–2, Sal 1–3        | Ja                     | Ja                               | Gyldige kombinasjoner, ikke egne «løse» rom.                                 |
| Bakgården               | Kun intern             | Avhengighet mot Sal 1–3 uavklart | Skjules for eksterne.                                                        |

## Funksjonsmatrise

P0 = nødvendig for en meningsfull første bookingpilot. P1 = neste trinn. P2 = senere. Prioriteringen følger møtereferatet og skal godkjennes med kunden.

### P0 — kjernebooking

| ID   | Krav                                                            | Eksisterer | Tilpasning | Ny utvikling | Ekstern avhengighet                                                  | Hva som finnes / mangler                                                                                                                                                                          |
| ---- | --------------------------------------------------------------- | ---------- | ---------- | ------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K01  | Romoversikt, kalender og innlogget booking av ett rom           | Ja         | Ja         | —            | Romliste, bilder og kapasitet fra kunden                             | Møterom har hele flyten. SKB-rom må byttes ut. Felles kalender for alle rom på frivillighetenshus.no er ikke ferdig som innebygd modul.                                                           |
| K01b | Flere rom i én booking, også ulike tider og datoer              | —          | —          | Ja           | —                                                                    | Møterom booker ett rom per transaksjon.                                                                                                                                                           |
| K02  | Automatisk sperring av soner og kombinasjoner                   | Delvis     | Ja         | Ja           | Godkjent rommatrise fra kunden; Digilist-motor                       | **FHH-demo:** `shared/zones.ts` + atomisk sjekk i demomotoren. **Digilist produksjon:** ikke denne leveransen — må verifiseres/utvikles i Digilist. Bakgården ↔ Sal 3 utenfor.                    |
| K02b | Bakgården kun intern, skjult for eksterne                       | Delvis     | Ja         | —            | Kundekategori på brukeren                                            | Demo: `internalOnly` + serverfilter for intern/ekstern. Live krever Digilist-prisgruppe/org.                                                                                                      |
| K03  | Fire kategorier: intern, medlem av intern, ideell, ekstern      | Delvis     | Ja         | Ja           | Prisliste og hvem som eier medlemslisten                             | FHH-demo: fire kategorier via organisasjonsrettigheter + `cheapest_valid`. Live Digilist-prisgruppe fortsatt egen sak.                                                                                                                                            |
| K04  | Organisasjon, org.nr og administrativ godkjenning               | Delvis     | Ja         | Ja           | Lister fra kunden. Ev. Brønnøysund / Frivillighetsregisteret / Proff | FHH-demo: org-modell, representantgodkjenning, Brønnøysund/fixture-verifisering. CSV-import og delegert org-admin = P1.                                                                                                                                           |
| K05  | Time / dag / kveld, rabatt og billigste gyldige pris            | —          | Ja         | Ja           | Godkjent prisark og testeeksempler                                   | Digilist kan gi tilbud. Møterom avviser total over 0. Laveste lovlige kombinasjon av time, dag og kveld er ny prislogikk.                                                                         |
| K06  | Leievilkår og avbestilling 5 dager (små rom) / 30 dager (saler) | Delvis     | Ja         | Ja           | Vilkårstekst og konsekvens ved sen avbestilling                      | Kunden kan avbestille. Frist per romtype og automatisk full faktura etter frist finnes ikke.                                                                                                      |
| K07  | Flere administratorer og grunnleggende roller                   | Ja         | Ja         | —            | Hvem som skal ha hvilke roller                                       | `full` / `operations` / `member` finnes. Husleder, bookingansvarlig og økonomi kan mappes hit. Service Crew er egen flate (K10).                                                                  |
| K08  | Økonomi- og fakturagrunnlag                                     | —          | Ja         | Ja           | Digilist faktura, betalingsleverandør, kundens regnskapsfører        | Interne: månedlig samleavregning. Øvrige: betaling eller faktura 14 dager. Møterom lager ikke faktura. Digilist kan planlegge faktura ved positiv saldo; det er ikke slått på for denne portalen. |

### P1 — drift og catering

| ID  | Krav                                                           | Eksisterer | Tilpasning | Ny utvikling | Ekstern avhengighet                          | Hva som finnes / mangler                                                               |
| --- | -------------------------------------------------------------- | ---------- | ---------- | ------------ | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| K09 | Catering i kundens bookingflyt                                 | —          | —          | Ja           | Mamas Mat: meny, priser, frister, allergener | Møterom har ingen meny eller tilleggsvarer.                                            |
| K10 | Mobil Service Crew-flate                                       | —          | —          | Ja           | Driftsregler 15 / 30 min før og etter        | Ny rolle og ny visning. Skal ikke sperre kundens ledighet.                             |
| K11 | Enkel Mamas Mat-flyt eller Google Sheets                       | —          | —          | Ja           | Leverandør, ev. Sheets-avtale                | Digilist bør være fasit. Leverandøren trenger en tynn flate, ikke adminpanelet.        |
| K12 | Rapporter og CSV / Excel til regnskap                          | Delvis     | Ja         | Ja           | Format avklares med regnskapsfører           | Innsikt finnes for belegg. Mangler eksport, omsetning, rabatt, catering og utestående. |
| K13 | Informasjonsskjerm med dagens møter                            | —          | —          | Ja           | Hvilke navn som kan vises offentlig          | Ny visning uten vanlig innlogging. Personvern må avklares.                             |
| I01 | Tilleggstjenester: scene, lyd, tekniker, Service Crew          | —          | —          | Ja           | Prisliste for tillegg                        | Ameniteter kan vises. De er ikke bookbare varer.                                       |
| I02 | Reservasjon av teknisk utstyr                                  | —          | —          | Ja           | Utstyrsliste og lagerregler                  | Egen kapasitet, ikke bare et notatfelt.                                                |
| I03 | Tag på booking                                                 | —          | —          | Ja           | Kundens kategorier                           | Statusfilter finnes. Fritekst-tag for rapportering finnes ikke.                        |
| I04 | Automatisk e-post: bekreftelse, vilkår, påminnelse, evaluering | —          | —          | Ja           | Digilist eller annen utsending. Ikke lovet.  | Møterom sender ikke e-post. OTP går via Digilist. Kvittering er ikke bekreftet.        |
| I05 | Intern meldingslogg på booking                                 | Ja         | Ja         | —            | —                                            | Bookingtråder finnes. E-postmaler og oppgavekobling til Service Crew finnes ikke.      |
| I06 | Notatfelt per booking                                          | Ja         | Ja         | —            | —                                            | Formål og notater finnes. Kan utvides til oppsett, AV og merknad til crew.             |
| I07 | Import av brukere og organisasjoner fra Excel / CSV            | —          | —          | Ja           | Fil fra kunden                               | Ingen import. Onboarding er manuell tilgangsforespørsel.                               |

### P2 — integrasjoner og finmasket drift

| ID  | Krav                                    | Eksisterer | Tilpasning | Ny utvikling | Ekstern avhengighet                         | Hva som finnes / mangler                                                                                                                   |
| --- | --------------------------------------- | ---------- | ---------- | ------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| K14 | Automatisk PowerOffice                  | —          | —          | Ja           | PowerOffice API, kontoplan, avtale, kostnad | Første nivå kan være CSV. API er ikke teknisk eller kommersielt bekreftet.                                                                 |
| K15 | Finmasket økonomirolle                  | —          | Ja         | Ja           | —                                           | Økonomi kan først få `operations` pluss innsikt. Egen «kun rapport»-rolle er senere.                                                       |
| K16 | Welcome Workdays / Entra-adgang         | —          | —          | Ja           | Entra, Welcome Workdays, API og avtale      | Interessant senere. Ikke del av første leveranse.                                                                                          |
| I08 | Flere fakturaadresser og avdelingskoder | —          | —          | Ja           | Kunderegister                               | Ingen fakturaadresse i Møterom.                                                                                                            |
| I09 | Varsel ved manglende betaling           | —          | —          | Ja           | Fakturamotor og e-post                      | Følger K08.                                                                                                                                |
| I10 | Ekstrafaktura ved brudd på vilkår       | —          | —          | Ja           | Husleder-prosess og satser                  | Admin kan ikke i dag registrere «ikke ryddet» og utløse tillegg.                                                                           |
| I11 | Pop-up-tilbud før registrering          | —          | —          | Ja           | Hva som skal tilbys                         | Ikke i Møterom.                                                                                                                            |
| I12 | Sidene på frivillighetenshus.no         | —          | —          | —            | Kundens nettsted / CMS                      | Forside, mat, om huset, Service Crew-rekruttering og blogg er ikke Møterom. Booking kan lenkes eller bygges inn når plassering er avklart. |
| I13 | Kalender-synk og e-signering            | Delvis     | —          | Ja           | Tredjepart                                  | ICS-nedlasting finnes. Løpende kalendersynk og e-signering finnes ikke.                                                                    |

## Anbefalt faseinndeling

### Fase 1 — kjernebooking (P0)

Mål: en leietaker logger inn, booker etter kategori og pris, og systemet sperrer ugyldige salkombinasjoner uten at personalet gjør det manuelt.

Innhold:

1. Eget Digilist-tenant og Møterom-portal for Frivillighetens Hus. Ny romkatalog. Ingen SKB-data.
2. Innlogget booking, kalender, godkjenning per rom, admin, meldinger. Dette er tilpasning av det som finnes.
3. Sonegraf i Digilist: Sal 1, 2, 3, kombinasjoner og Bakgården. Dette er ny motor.
4. Fire kundekategorier, org-godkjenning og pristilgang.
5. Åpne betalt tilbud i portalen, eller holde internpilot gratis til prisreglene er testet. Ikke midt imellom.
6. Vilkår ved booking og kanselleringsfrist 5 / 30 dager. Konsekvens etter frist må besluttes før den kodes.
7. Minimum fakturagrunnlag (eksport eller Digilist-faktura) hvis kunden ikke kan piloitere uten det.

Kontrollpunkt: rommatrise, medlemsliste og prisark er godkjent. Akseptscenariene i møtereferatet kapittel 15 for rom, pris og kansellering går grønt.

### Fase 2 — drift og catering (P1)

Catering i samme flyt, enkel leverandørflate, Service Crew med 15 / 30 min arbeidsvindu, infoskjerm, utstyr og tagger. Krever workshop med Mamas Mat.

### Fase 3 — økonomi (P2, deler kan trekkes frem)

CSV først. PowerOffice, betalingsoppfølging, kreditering og kontering etter at regnskapsfører er med. Adgangskontroll etter at bookingen er stabil.

## Hva som ikke skal loves nå

- At Møterom allerede håndterer Sal 1–3.
- At fire priskategorier eller «billigste gyldige pris» finnes.
- Betaling, faktura, e-postkvittering eller PowerOffice.
- Catering eller Service Crew som ferdig flate.
- Welcome Workdays.
- At sidene på frivillighetenshus.no erstattes av Møterom.
- Pris etter prøveperioden. Møtet ga seks måneder gratis prøve. Omfang og pris etter det er uavklart.

## Åpne spørsmål til neste møte

**Rom og regler**

- Er det Styrerommet eller Syerommet?
- Full sonegraf, inkludert Bakgården mot Sal 1–3.
- Kan Sal 3 leies når Sal 1+2 er opptatt?

**Medlemskap**

- Hvem eier listen over interne organisasjoner og deres medlemmer?
- Hvilket bevis kreves før intern- eller medlemspris gis?
- Skal ideell status slås opp i Frivillighetsregisteret, eller holder manuell godkjenning i piloten?

**Pris og vilkår**

- Full prisliste for alle rom, dag / kveld / helg / dagspris.
- Kan dagspris kombineres med kveld?
- Hva skjer ved avbestilling etter 5 / 30 dager: full faktura, gebyr eller unntak?
- Skal betalte bookinger åpnes i fase 1, eller intern gratis-pilot først?

**Økonomi**

- Hvem fakturerer, og i hvilket system, i prøveperioden?
- Er CSV nok i fase 1?
- Finns PowerOffice API og hvem betaler integrasjonen?

**Catering (siste 10 min med Mamas Mat)**

- Hvem kan endre ordre etter bekreftelse?
- Endringsfrist og intern innkjøpspris mot utpris.
- Sheets midlertidig eller varig?

## Foreslått aksept for fase 1

Fra møtereferatet, begrenset til det som hører hjemme før catering:

1. Booking av Sal 1+2 sperrer overlappende soner. Uavhengig Sal 3 forblir ledig hvis matrisen tillater det.
2. Verifisert intern bruker ser internpris. Ekstern ser ordinær pris.
3. Samme tidsrom prises riktig etter avtalt time- / dag- / kveldsregel.
4. Kansellering innenfor og utenfor frist følger avtalt regel.
5. Kunden finner rom og booker fra mobil uten å gå via et stort adminpanel.

Catering, Service Crew, Mamas Mat-endring og månedlig avregning hører til fase 2–3.

## Tekniske spørsmål Xala må avklare internt før tilbud

1. Skal sonegrafen inn i Digilist `validateBookingSlot` / `bookings.create`, eller som portalregel i Møterom BFF? Motoren må eie den. UI-filter alene er ikke nok.
2. Skal Møterom åpne betalte tilbud for denne tenanten, eller skal FH bruke Digilist-faktura utenfor portalen i fase 1?
3. Blir FH eget hostname (anbefalt, se `docs/multi-tenant-portals.md`) eller midlertidig eget Møterom-deploy?
4. Hvilken Digilist-prisstruktur finnes allerede (time, døgn, tillegg), og hva må nyttes for «billigste gyldige»?
5. PowerOffice: kartlegg API, felt og kostnad. Ikke ta det inn i fase 1-prisen uten eget tillegg.
