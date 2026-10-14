# Frivillighetens Hus — fremdriftsplan etter demo

## Kunden leverer

1. Full rommatrise (inkl. Sal 1–3 / Bakgården-avhengigheter)
2. Prisark (time/dag/kveld, fire kategorier, eksempler)
3. Organisasjonsliste / medlemslister for import
4. Leievilkår og konsekvenser ved sen avbestilling
5. Fakturaeksempler / ønsket CSV-feltliste
6. LoopBooking: månedspris, oppsigelsestid, migreringsbehov

## Xala utvikler (rekkefølge)

1. Digilist DEV-tenant + private `tenant_portal`-rom + live-flip (public access)
2. P0: sonegraf, prisgrupper, org-godkjenning, vilkår
3. P1: catering/Mamas Mat, Service Crew, infoskjerm, eksport
4. P2: PowerOffice, adgang — etter egen avklaring

## Tester før produksjon

- Soner: Sal 1+2 blokkerer overlapp; Sal 3 kan være ledig
- Intern vs ekstern (og ideell) pris fra godkjent profil
- Pending holder tid; confirmed etter admin
- Isolasjon mot SKB og marketplace
- Mobil booking uten kritisk layoutfeil

## Dokumenter

- [Funksjonsmatrise](frivillighetens-hus-funksjonsmatrise.md)
- [Pilotscope](fhh-pilot-scope.md)
- [Demomanus](fhh-demo-walkthrough.md)
- [Isolasjon](fhh-demo-isolation.md)
