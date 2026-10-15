# Frivillighetens Hus — demomanus (torsdag 15. oktober)

Live: `https://fhh.digilist.no`  
Modus: demo, `BOOKING_ACCESS=public`. SKB (`skb.digilist.no`) skal ikke berøres.

## Fem kjerneflyter (må være grønne før møtet)

1. Åpne Finn rom uten innlogging — FHH-romnavn, prisstige på Elvebredden.
2. Velg tid → login kreves → **Prøv som ekstern** → quote 800 kr/t på Elvebredden (1 time).
3. Logg ut → **Prøv som intern** → samme slot → 400 kr/t; Bakgården synlig.
4. Book Sal 1 → status pending → admin godkjenner → confirmed. Pending holder tiden.
5. Admin-kalender: bekreftet, ventende, vedlikeholdsblokk.

## Sonedemo (Sal 1 / 2 / 3) — demomanus

Kjører i **demomotoren** (SQLite). Si i møtet: produksjon i Digilist er neste byggetrinn.

Følger nettsidens produkter (Sal 1, 2, 3, 1–2, 1–3). **Sal 2–3 finnes ikke.** Sal 1 og Sal 2 er kun for interne (som på nettsiden — bekreftes før prod).

1. Under **Salene**: velg **Sal 1–2** → book kl. 10–12 (ekstern OK; godta vilkår).
2. Vis at Sal 1–3 blir utilgjengelig med forklaring om overlappende del av salen.
3. Vis at Sal 3 fortsatt er ledig og kan bookes.
4. Kanseller Sal 1–2 → soner frigjøres; Sal 1–3 kan bookes igjen.

Seed: i morgen kl. 10–12 ligger allerede en pending booking på Sal 1–2 (synlig konflikt uten å booke først).

## Møtedisposisjon (60 min)

| Tid   | Vis                                  | Formål              |
| ----- | ------------------------------------ | ------------------- |
| 0–10  | Mobil + åpen katalog                 | Enkelhet            |
| 10–20 | Ekstern vs intern quote              | Kundetilpasning     |
| 20–30 | Bakgården + sal-godkjenning + vilkår | Kontroll            |
| 30–40 | Sonedemo Sal 1–2, kalender, innsikt  | Dagens problemer    |
| 40–50 | Funksjonsmatrise + pilotscope        | Enighet             |
| 50–60 | Mamas Mat-skisse                     | Cateringkartlegging |

Lite tid på design. De var allerede positive visuelt.

## Ærlige gap (si høyt)

- Sonemotor for Sal 1/2/3 fungerer i **FHH-demo**. Digilist live sonegraf er ikke denne leveransen.
- Ideell 560 kr vises; bookingen regner kun intern vs ekstern.
- Time/dag/kveld og billigste pris = P0 senere.
- Catering, Service Crew, PowerOffice = ikke bygget.
- Bakgården ↔ Sal 3 er ikke modellert.

## Beslutning (ca. 40–50 min)

> Vi har nå vist hvordan Frivillighetens Hus kan få en enklere møteromsbooking med deres egne rom, ulike kundekategorier og administrativ kontroll.
>
> Vi foreslår å starte et seks måneders pilotprosjekt der vi først får bookingmotoren og de viktigste reglene på plass.
>
> Deretter utvikler vi de avtalte tilpasningene og tester dem sammen med dere.
>
> Kan vi bli enige om å gå videre med pilotprosjektet, forutsatt at vi avklarer funksjonsomfang og leveranseplan?

Sikre enighet om: retning, pilotinnhold, kundedata (rommatrise, prisark, org-liste, vilkår), beslutningstaker, startdato. Avklar også LoopBooking-kostnad, oppsigelse og migrering.

## Mamas Mat (siste 10 min)

Én flyt, to virksomheter:

- Kunden bestiller rom + mat i samme opplevelse (fremtid).
- Frivillighetens Hus fakturerer kunden for rom og mat.
- Mamas Mat fakturerer Frivillighetens Hus for levert mat.
- Kjøkken trenger enkel mobil/Sheets-arbeidsflate, ikke tung admin.

## Reserve

Etter grønn aksept: ta skjermbilder eller kort opptak av de fem flytene. Presenter live; reserve kun ved feil.

## Isolasjon

Se [fhh-demo-isolation.md](fhh-demo-isolation.md).
