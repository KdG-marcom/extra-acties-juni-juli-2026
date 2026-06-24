/**
 * build-data.js — genereert data.json uit de KdG-Airtable.
 * Wordt elk uur uitgevoerd door de GitHub Action (.github/workflows/update-data.yml).
 *
 * Vereist env-variabele AIRTABLE_TOKEN (Personal Access Token met read-rechten op de base).
 * Optioneel: AIRTABLE_BASE (default = de KdG-base hieronder).
 *
 * Node 18+ (globale fetch). Geen externe dependencies.
 */
const fs = require('fs');

const BASE  = process.env.AIRTABLE_BASE || 'app5z11dea8hXFutk';
const TOKEN = process.env.AIRTABLE_TOKEN;
const OPL_TABLE = 'Opleidingen';
const ACT_TABLE = 'Acties';

if (!TOKEN) { console.error('FOUT: AIRTABLE_TOKEN ontbreekt.'); process.exit(1); }
const HEADERS = { Authorization: `Bearer ${TOKEN}` };

async function fetchAll(table) {
  let records = [], offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} — ${await res.text()}`);
    const json = await res.json();
    records = records.concat(json.records);
    offset = json.offset;
  } while (offset);
  return records;
}

const sel = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v.name : v;

(async () => {
  // 1) Opleidingen + id→key-map. Key = "naam | type" zodat dezelfde naam met een ander
  //    type (bv. Maatschappelijk Werk als bachelor én graduaat) apart blijft bestaan.
  const oplRecords = await fetchAll(OPL_TABLE);
  const idToKey = {}, seen = {}, opleidingen = [];
  for (const r of oplRecords) {
    const f = r.fields;
    const naam = f.Name, type = sel(f.Notes) || '', campus = sel(f.Infodag_campus) || '';
    if (!naam) continue;
    const key = naam + ' | ' + type;
    idToKey[r.id] = key;
    if (!seen[key]) {
      seen[key] = 1;
      opleidingen.push({ key, naam, type, campus });
    }
  }
  opleidingen.sort((a, b) => a.naam.localeCompare(b.naam, 'nl') || a.type.localeCompare(b.type, 'nl'));

  // 2) Acties — één record kan aan meerdere opleidingen hangen (elk dezelfde data)
  const actRecords = await fetchAll(ACT_TABLE);
  const acties = {};
  for (const r of actRecords) {
    const f = r.fields;
    const links = f.Opleiding || [];
    if (!links.length) continue;
    const rec = {
      mailNaam:   f['MAIL_Naam'] || '',           mailEmail: f['MAIL_E-mail'] || '',
      chatNaam:   f['CHAT_Naam'] || '',            chatFunctie: f['CHAT_Functie'] || '',   chatUrl: f['CHAT_Unibuddy url'] || '',
      onlineNaam: f['1-OP-1-ONLINE_Naam'] || '',   onlineEmail: f['1-OP-1-ONLINE_E-mail'] || '', onlineUrl: f['1-OP-1-ONLINE_Tool-url'] || '',
      fysiekNaam: f['1-OP-1-FYSIEK_Naam'] || '',   fysiekEmail: f['1-OP-1-FYSIEK_E-mail'] || '', fysiekUrl: f['1-OP-1-FYSIEK_Tool-url'] || '',
      ioDatum:    f['INFOSESSIE-ONLINE_Datum en startuur'] || '', ioDuur: f['INFOSESSIE-ONLINE_Duur'] || '', ioUrl: f['INFOSESSIE-ONLINE_Inschrijvingslink'] || '',
      ifDatum:    f['INFOSESSIE-FYSIEK_Datum en startuur'] || '', ifDuur: f['INFOSESSIE-FYSIEK_Duur'] || '', ifCampus: sel(f['INFOSESSIE-FYSIEK_Campus']) || '', ifOnthaal: f['INFOSESSIE-FYSIEK_Onthaal locatie'] || ''
    };
    const heeftInhoud = rec.mailEmail || rec.chatUrl || rec.onlineUrl || rec.onlineEmail || rec.fysiekUrl || rec.fysiekEmail || rec.ioUrl || rec.ifDatum;
    if (!heeftInhoud) continue;   // record zonder echte acties overslaan
    for (const link of links) {
      // linked field bevat record-IDs (REST). Map id → key ("naam | type").
      const key = idToKey[(typeof link === 'string') ? link : link.id];
      if (key) acties[key] = rec;
    }
  }

  const out = { updated: new Date().toISOString(), opleidingen, acties };
  fs.writeFileSync('data.json', JSON.stringify(out, null, 2));
  console.log(`data.json geschreven: ${opleidingen.length} opleidingen, ${Object.keys(acties).length} met acties.`);
})().catch(e => { console.error(e); process.exit(1); });
