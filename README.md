# KdG – Extra contactmomenten (embeddable widget)

Een widget voor studiekiezers: kies je opleiding en zie de beschikbare contactacties
(mail, chat, 1-op-1 afspraak online/op de campus, online infosessie, infomoment op de campus).
De data komt uit Airtable en wordt **elk uur** automatisch ververst.

## Hoe het werkt

```
Airtable  ──(elk uur, GitHub Action met token uit Secrets)──>  data.json  ──(fetch)──>  widget (index.html)  ──(iframe)──>  kdg.be
```

- `index.html` — de widget. Leest `data.json` (zelfde origin) bij het laden.
- `data.json` — de gepubliceerde data. **Wordt automatisch overschreven** door de Action; niet manueel bewerken.
- `build-data.js` — haalt de Airtable op en schrijft `data.json`. Het Airtable-token komt uit een GitHub Secret en staat dus **nooit** in de gepubliceerde code.
- `.github/workflows/update-data.yml` — draait `build-data.js` elk uur en commit `data.json`.

> **Belangrijk:** `data.json` is publiek leesbaar. Dat is hier de bedoeling (publieke contactinfo).
> Zet geen velden in de Airtable-tabel `Acties`/`Opleidingen` die niet publiek mogen worden.

## Eenmalige setup

1. **Maak een GitHub-repo** (bv. `kdg-contactmomenten`) en zet deze bestanden erin:
   ```
   index.html
   data.json
   build-data.js
   .github/workflows/update-data.yml
   README.md
   ```
2. **Airtable Personal Access Token** aanmaken (airtable.com → Builder hub → Personal access tokens):
   - scope: `data.records:read` en `schema.bases:read`
   - toegang: de base *Extra marketing-acties juni-juli 2026* (`app5z11dea8hXFutk`)
3. **Token als GitHub Secret** zetten: repo → Settings → Secrets and variables → Actions →
   *New repository secret* → naam **`AIRTABLE_TOKEN`**, waarde = het token.
4. **GitHub Pages** aanzetten: repo → Settings → Pages → Source = *Deploy from a branch*,
   branch = `main`, map = `/ (root)`. Je krijgt een URL zoals
   `https://<org>.github.io/kdg-contactmomenten/`.
5. **Eerste run**: ga naar de Actions-tab → *Update data.json* → *Run workflow*
   (of push gewoon naar `main`). Daarna draait hij vanzelf elk uur.

## Embedden op kdg.be

Plak deze code op de pagina waar de widget moet komen. Pas de `src`-URL aan naar je Pages-URL.

```html
<iframe id="kdg-acties"
        src="https://<org>.github.io/kdg-contactmomenten/"
        title="Extra contactmomenten KdG"
        style="width:100%; border:0; height:900px;"
        loading="lazy"></iframe>
<script>
  // Past de iframe-hoogte automatisch aan op de inhoud
  window.addEventListener('message', function (e) {
    if (e.data && e.data.kdgHeight) {
      var f = document.getElementById('kdg-acties');
      if (f) f.style.height = e.data.kdgHeight + 'px';
    }
  });
</script>
```

De widget erft lettertype en tekstgroottes van de pagina waarin hij staat. Op kdg.be neemt hij
dus automatisch de site-typografie over.

## Preview / voorbeelddata

- Normaal toont de widget **enkel opleidingen die in Airtable ingevuld zijn**.
- Voor een demo van álle opleidingen met illustratieve acties: open de widget met `?preview=1`,
  bv. `https://<org>.github.io/kdg-contactmomenten/?preview=1`. Er verschijnt dan een schakelaar
  "Voorbeelddata tonen". Deze preview-modus verschijnt nooit in de normale (ingebedde) weergave.

## Lokaal testen

Open `index.html` niet rechtstreeks via `file://` voor de live data — browsers blokkeren dan de
`fetch` van `data.json`. De widget valt in dat geval terug op een ingebouwde momentopname.
Voor een echte test: `npx serve` (of een andere statische server) in deze map en surf naar de
lokale URL.

## Data zelf verversen (handmatig)

```bash
AIRTABLE_TOKEN=pat_xxx node build-data.js
```

## Airtable-structuur (ter referentie)

- Tabel **Opleidingen**: `Name`, `Notes` (type), `Infodag_campus` (campus).
- Tabel **Acties** (1 record kan aan meerdere opleidingen hangen):
  `MAIL_Naam`, `MAIL_E-mail`, `CHAT_Naam`, `CHAT_Unibuddy url`,
  `1-OP-1-ONLINE_Naam/E-mail/Tool-url`, `1-OP-1-FYSIEK_Naam/E-mail/Tool-url`,
  `INFOSESSIE-ONLINE_Datum en startuur/Duur/Inschrijvingslink`,
  `INFOSESSIE-FYSIEK_Datum en startuur/Duur/Campus/Onthaal locatie`.

> Tip: de **fysieke infosessie** heeft nog geen eigen inschrijvingslink-veld. Voeg er eventueel een
> toe en breid `build-data.js` (`ifUrl`) + de widget uit; nu valt die knop terug op de algemene
> infodagen-pagina.
