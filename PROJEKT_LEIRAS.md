# Családi költségvetés app – projektleírás

> Ez a dokumentum összefoglalja, mit és miért döntöttünk az app tervezésekor.
> Ha később módosítani szeretnéd az appot, először ezt olvasd el (vagy add oda Claude-nak),
> és onnan folytathatod a munkát.

**Létrehozva:** 2026. október 12.
**Állapot:** az 1. és 2. fázis kész: az app élesben, mindkét telefon belépve, közös adatokkal.

---

## 1. Mi a cél?

Egy **magyar nyelvű, telefonon használható app**, amely megmutatja a háztartás
**havi bevételeit és kiadásait kategóriánként**.

Miért kell? A bank saját appja:
- nem kezeli jól a kategóriákat,
- egy nagy bevásárlást (pl. szupermarketben) egyetlen tételként könyvel el,
  pedig abban lehet étel, háztartási cikk, ruha stb. is.

Az app három forrásból gyűjti össze a pénzmozgásokat, és **semmit nem számol kétszer**.

**Felhasználók:** Zsolt és a felesége, mindketten iPhone-nal (különböző típusokkal).

---

## 2. Honnan jönnek az adatok?

| Forrás | Hogyan kerül az appba? | Megjegyzés |
|---|---|---|
| **CIB bankszámlakivonat (PDF)** | Feltöltés, a telefon ingyen beolvassa | A bolt nevéből az app kategóriát javasol |
| **Blokkok (nyugták)** | iPhone „Élő szöveg” funkció → másolás → beillesztés | Tételenként bontva, mindegyik saját kategóriát kap |
| **Kézi bevitel** | Egyszerű űrlap | **Készpénzes** vásárlás, előfizetések (pl. Claude Pro), egyéb bevétel |

---

## 3. Szabályok: párosítás és különleges esetek

- **Blokk ↔ banki tétel:** az app **dátum + összeg + bolt** alapján összepárosítja őket.
  Ilyenkor a banki tételt nem számolja újra, hanem a blokk tételei szerint bontja fel.
- **Kézi bevitel ↔ banki tétel:** csak a **„Kártya / utalás”** módon fizetett kézi tételeknél.
  Az app automatikusan összekapcsolja őket, ha:
  - az összeg **pontosan egyezik**, és legfeljebb **±3 nap** az eltérés, **vagy**
  - a **név egyezik** (pl. „Netflix” ↔ „NETFLIX.COM”), az összeg legfeljebb **50%-kal** tér el
    (árváltozás, devizás fizetés), és legfeljebb **±7 nap** az eltérés.
  Összekapcsolás után **a banki tétel számít** (a valódi összeggel), a kézi tétel neve és kategóriája látszik rajta.
  Ha a kivonat már fel van töltve, de nincs találat, a tételnél **⚠️ figyelmeztetés** jelenik meg.
- **Készpénzfelvétel (ATM):** címke: **„Készpénzfelvétel”**, **nem számít kiadásnak**,
  mert a készpénzből vásárolt dolgokat kézzel rögzítjük (különben kétszer számolódna).
- **Készpénzes blokk / kézi tétel:** önálló kiadás, nincs mihez párosítani (nem jelenik meg a kivonaton).
- **Átutalás a fő számláról az alszámlára:** címke: **„Megtakarítás”**.
- **Átutalás az alszámláról a fő számlára:** címke: **„Megtakarítás feloldása”**.
- **A megtakarítás nem számít bele a havi kiadásokba**, de a hó végi kimutatásban
  és összesítőben **saját, külön szakaszt kap**. *(Megerősítve: 2026. 10. 12.)*

---

## 4. Kategóriák

**Kiadások:** Élelmiszer, Háztartás, **Baba**, Rezsi, Étterem/rendelés, Szórakozás, Közlekedés,
Előfizetések, Egészség, Ruházat, Hitel, Biztosítás, Egyéb

**Bevételek:** Fizetés, Visszatérítés, Kamat, Egyéb bevétel

**Megtakarítás:** Megtakarítás, Megtakarítás feloldása

A **Rezsi, Étterem/rendelés, Hitel és Biztosítás** kategória a valódi szeptemberi
kivonatok alapján került be (az eredeti 8-as listához képest), mert ezek gyakori,
nagy tételek voltak.

A **👶 Baba** kategória (2026. 10. 13.) ide kerül automatikusan:
- **banki tételek:** pelenka.hu, Brendon, bababoltok, és a gyerek-/babaruha boltok kártyakódja (MCC 5641);
- **blokk tételek:** Pampers, Huggies, Libero, Babydream, Babylove, pelenka, tápszer, HiPP, Aptamil,
  bébiétel, cumi, popsikrém, „baba”/„bébi” szavak stb.
- **Kivételek** (Élelmiszer marad): babapiskóta, bébispenót, bébirépa, babakukorica, Babybel.

Ha egy szabály változik, az app induláskor **újra besorolja az automatikusan besorolt** banki tételeket
(a korábbi hónapokban is). Amit kézzel átsoroltál, azt soha nem írja felül.

### Hogyan kap egy tétel kategóriát?
1. Ha korábban kézzel átsoroltál egy boltot, és bepipáltad, hogy „mindig ezt használd”, akkor azt.
2. Ha a bolt neve ismert (pl. SPAR, Wolt, DM, MVM), akkor az alapján.
3. Különben a bank által minden kártyás vásárláshoz megadott **bolttípus-kód (MCC)** alapján.
4. Ha semmi nem illik rá: Egyéb.

---

## 4/b. Kézi bevitel (2. lépés)

- A **Tételek** fülön a jobb alsó **+** gombbal.
- Mezők: Kiadás/Bevétel, összeg, megnevezés, dátum, kategória (a név alapján az app javasol),
  fizetés módja (**💵 Készpénz** vagy **💳 Kártya / utalás**), ki (a kártyákhoz beírt nevek + „Közös”), megjegyzés.
- **Havonta ismétlődik:** pl. előfizetéseknél. Az app minden hónapban automatikusan felveszi,
  amikor eljön a napja. Egy havi példány törlése nem hozza vissza azt a hónapot;
  az **„Ismétlés leállítása”** gombbal megállítható (a régi tételek megmaradnak).
- Kézi tételre koppintva **szerkeszthető** vagy **törölhető**.

---

## 4/c. Blokkok (3. lépés)

1. iPhone **Fotók** → a blokk fotója → **Élő szöveg** ikon → **Összes kijelölése → Másolás**.
2. Az appban: **+ → Blokk beillesztése** → **Beillesztés a vágólapról** → **Feldolgozás**.
3. Az app felismeri: **bolt, dátum, fizetés módja, tételek, árak, végösszeg**.
   - A **kedvezmény** a fölötte lévő tételből levonódik, a **visszaváltási díj** a fölötte lévő italhoz adódik.
   - Ha a blokk széles, és az Élő szöveg külön adja a neveket és az árakat, azt is kezeli.
4. **Ellenőrző képernyő:** minden szerkeszthető (név, ár, kategória, törlés, új tétel).
   Zöld ✓, ha a tételek összege egyezik a végösszeggel; ⚠️, ha nem.
   Ha a tételekből hiányzik valamennyi, „Egyéb tétel” sorként felvehető.
5. **Tételenkénti kategória:** termékszavak alapján (pl. TEJ → Élelmiszer, MOSÓPOR → Háztartás),
   különben a bolt kategóriája. **Az app megjegyzi**, amit mentéskor beállítottál.
6. **Kártyás blokk:** összekapcsolódik a banki tétellel (ugyanaz a szabály, mint a kézi tételeknél),
   és a banki tétel a blokk kategóriái szerint **oszlik meg** (pl. 16 633 Ft SPAR =
   13 143 Ft Élelmiszer + 3 490 Ft Háztartás). **Készpénzes blokk:** önállóan számít.

**Döntés (2026. 10. 13.):** marad az iPhone **Élő szöveg + beillesztés** módszer.
Megvizsgált, de most elvetett lehetőségek (később elővehetők):
- *Ingyenes szövegfelismerés az appban (Tesseract):* fotó az appból, 0 Ft, de pontatlanabb, ~10 MB letöltés.
- *Claude olvassa a fotót (Claude API):* a legpontosabb, kb. 1–3 Ft/blokk, de kell hozzá egy kis
  privát szerver (pl. Supabase), mert az API-kulcs nem lehet a nyilvános kódban.

⚠️ A blokkolvasót kitalált minta-blokkokon teszteltük (`tools/receipt-samples/`). Valódi blokkok
szövegével tovább pontosítható: ilyenkor a valódi szöveget **nem** tesszük a projektbe, csak a mintáját.

---

## 5. Hó végi kimutatás – „📊 Kimutatás” fül (elkészült)

A hónapot a fül tetején lehet váltani (ugyanaz, mint a Tételek fülön).

- **Összesítő kártyák:** Bevétel, Kiadás, **Maradék** (bevétel − kiadás), mindegyiknél
  a változás az előző hónaphoz képest (▲/▼; zöld, ha jó irányba változott).
  Összehasonlítás csak **teljes** előző hónappal történik (a kivonatok lefedik az egész hónapot,
  vagy vannak benne kézi tételek), különben félrevezető lenne.
- **Készpénzfelvétel** külön sorban (nem kiadás).
- **Kiadások kategóriánként:** vízszintes sávok, a legnagyobb elöl, összeg + százalék.
  A blokkok tételei a saját kategóriájukba számítanak.
- **Bevétel és kiadás hónaponként:** az utolsó legfeljebb 6 hónap oszlopai.
  Egy oszlopra koppintva fölötte megjelennek a pontos számok. **Táblázat** nézet is van.
- **Megtakarítás (külön szakasz):** Félretett, Visszavett, Nettó; hónaponkénti oszlop
  (fölfelé kék: félretett, lefelé piros: többet vettetek vissza).
- A színeket színtévesztők számára is ellenőriztük, világos és sötét módban is.

---

## 6. Fázisok és költségek

| Fázis | Mit jelent? | Költség |
|---|---|---|
| **1. fázis (most)** | Csak Zsolt iPhone-ján, az adatok a telefonon tárolódnak. Lesz **mentés/exportálás gomb**, hogy semmi ne vesszen el. | **0 Ft** |
| **2. fázis (később)** | Ingyenes **Supabase** adatbázis, hogy a feleség telefonja is ugyanazt lássa. EU-s szerver, csak ti ketten léphettek be. | **0 Ft** |
| **Opcionális** | Claude API a blokkok automatikus beolvasásához (fotóból) | kb. 5 dollár egyszeri feltöltés, ami várhatóan egy évnél is tovább kitart |

Fontos: a **Claude Pro előfizetés nem használható** az appban. Az app számára
a Claude API kellene, ami külön, használat alapján fizetős szolgáltatás.

---

## 6/b. 2. fázis: közös használat (Supabase)

**Döntések (2026. 10. 13.):**
1. **Belépés:** e-mail-cím + a levélben kapott **kód** (jelszó nincs).
2. **Tárolás:** Supabase, **EU (Frankfurt)** adatközpont. Felhőbe kerül: összegek, boltnevek, kategóriák,
   a kártyákhoz írt nevek és a kártyák utolsó 4 számjegye. **Nem** kerül fel: PDF-ek, teljes kártya- és számlaszám.
3. **Offline is működik:** a változások internet nélkül is mentődnek, és később szinkronizálódnak.
4. **Csak a két e-mail-cím** léphet be (engedélyezési lista az adatbázisban).
5. **Face ID zár:** most nem.

**Biztonsági rétegek:** 2FA a Supabase fiókon; belépés e-mail-kóddal; engedélyezési lista + az új regisztráció
kikapcsolása; **Row Level Security** (az adatbázis minden sornál ellenőrzi, hogy a kérdező a háztartás tagja-e);
a titkos kulcs soha nincs az appban; titkosított kapcsolat (HTTPS). A legfontosabb otthoni teendő:
**2FA a Gmail-fiókokon**, mert az e-mail a belépés kulcsa.

**Működés:**
- Az app továbbra is a telefonon tárolja az adatokat, és a háttérben szinkronizál:
  megnyitáskor, változás után néhány másodperccel, és nyitva tartva percenként.
- Minden adat külön „rekord” a felhőben, így a két telefon egyszerre is módosíthat különböző dolgokat.
  Ugyanazon tétel egyidejű módosításánál az utolsó mentés nyer.
- Törléskor a felhőben egy „törölve” jelzés marad, hogy a másik telefon is értesüljön.
- **Kijelentkezés:** az adatok törlődnek a telefonról, a felhőben megmaradnak.
- Belépve a **„Minden adat törlése”** gomb el van rejtve (mindkét telefonról törölne).
- A fejlécben ☁️ jelzés mutatja az állapotot (✓ szinkronizálva, … folyamatban, offline, ⚠️ hiba).

**Beállítási lépések:** lásd `supabase/README.md`.

---

## 7. Hogyan kerül fel az iPhone-ra?

1. **Tesztelés:** az app Zsolt Mac-jén fut, az iPhone ugyanazon a Wi-Fi-n nyitja meg.
2. **Valódi használat:** ingyenes tárhelyre (GitHub Pages vagy Netlify) kerül fel.
   A fiókot Zsolt hozza létre, Claude lépésről lépésre végigvezeti.
   Utána Safariban: **Megosztás → Főképernyőhöz adás**, és saját ikonja lesz,
   mint egy rendes appnak.

Nem kell otthoni szerver, és nem kell az App Store sem.

---

## 8. Technikai döntések (egyszerűre tervezve, első projektnek)

- **Webes app (PWA):** weboldal, ami appként viselkedik. Minden iPhone-on működik, típustól függetlenül.
- **Egyszerű HTML + CSS + JavaScript**, bonyolult építőeszközök nélkül.
- **pdf.js:** ingyenes eszköz a PDF bankkivonat beolvasásához, közvetlenül a telefonon.
- **Grafikonok:** saját, egyszerű HTML/CSS megoldás (a Chart.js helyett): kisebb, offline is működik,
  és illeszkedik a világos/sötét módhoz.
- **Tárolás az 1. fázisban:** a telefon böngészőjének saját tárhelye (helyi tárolás).

### Amit a CIB kivonatról megtudtunk (2026. szeptemberi minták alapján)

- A PDF **valódi szöveget tartalmaz** (nem beszkennelt kép), ezért ingyen beolvasható.
- A kártyás vásárlások így néznek ki: „BANKKÁRTYA TERHELÉS … *bolt neve, város*”.
- A saját számlák közötti utalás így jelenik meg: „Saját számlák közötti eseti utalás”.
- A három minta ugyanannak a számlának különböző időszakai.

---

## 9. Fogalomtár (egyszerűen)

- **Webes app (PWA):** weboldal, amit a telefon főképernyőjére lehet tenni, és appként működik.
- **Tárhely (hosting):** egy internetes számítógép, ami tárolja az app fájljait, és odaadja a telefonnak, amikor megnyitod.
- **Helyi tárolás:** egy kis privát „jegyzetfüzet” a telefonon, ahová az app az adatait menti.
- **Adatbázis (Supabase):** egy közös, online „füzet”, amit mindkét telefon olvas és ír.
- **Ingyenes csomag (free tier):** a szolgáltató kis használat esetén ingyen adja a szolgáltatást.
- **API:** egy „ajtó”, amin keresztül az egyik program segítséget kér egy másiktól (pl. az app a Claude-tól).
- **Élő szöveg (Live Text):** iPhone funkció, amellyel szöveget lehet kimásolni egy fényképből.

---

## 10. Az app felépítése (fájlok)

| Fájl / mappa | Mire való? |
|---|---|
| `app/` | Maga az app: ez kerül fel a telefonra / a tárhelyre |
| `app/index.html`, `app/styles.css` | A képernyők és a kinézet |
| `app/js/banks/index.js` | **A támogatott bankok listája**; a feltöltött PDF-ből felismeri a bankot |
| `app/js/banks/cib.js` | A CIB PDF kivonat beolvasása és ellenőrzése |
| `app/js/categories.js` | Kategóriák és a besorolási szabályok (bankkivonat és blokk-tételek) |
| `app/js/sync.js` | 2. fázis: belépés e-mail-kóddal és szinkronizálás a Supabase-szel |
| `app/vendor/supabase/` | A Supabase ingyenes kapcsolódó könyvtára (supabase-js 2.117.2) |
| `supabase/schema.sql` | Az adatbázis és a biztonsági szabályok (egyszer kell lefuttatni) |
| `supabase/README.md` | A Supabase beállításának lépései (magyarul) |
| `tools/test-sync.mjs` | Fejlesztői ellenőrzés: két szimulált telefon szinkronizálása (`node tools/test-sync.mjs`) |
| `app/js/report.js` | A hó végi kimutatás számításai (összesítők, kategóriák, hónapok) |
| `app/js/receipt-parser.js` | A blokk szövegének beolvasása (bolt, dátum, tételek, végösszeg) |
| `app/js/store.js` | Adatok mentése a telefonon, biztonsági mentés |
| `app/js/app.js` | A képernyők működése |
| `app/icons/icon.svg` | Az app ikonja (barna bőr pénztárca kártyával); ebből készülnek a PNG méretek |
| `app/vendor/pdfjs/` | Ingyenes PDF-olvasó könyvtár (pdf.js) |
| `tools/check-statement.mjs` | Fejlesztői ellenőrzés: beolvas egy kivonatot, és megnézi, egyeznek-e az összegek |
| `tools/test-receipts.mjs` | Fejlesztői ellenőrzés a minta-blokkokkal (`node tools/test-receipts.mjs`) |

### Új bank hozzáadása (pl. később Revolut)
1. Kell egy minta-kivonat az adott banktól (PDF).
2. Claude készít egy új fájlt: `app/js/banks/<bank>.js` (a `cib.js` mintájára).
3. A bankot fel kell venni a listába az `app/js/banks/index.js` fájlban.
Mást nem kell módosítani: a feltöltés, a kategóriák, a párosítás és a kimutatás automatikusan működik.

### Indítás tesztelésre (Mac + iPhone, ugyanazon a Wi-Fi-n)
1. Terminálban, ebben a mappában: `npm start`
2. iPhone Safariban: `http://<a Mac IP-címe>:8080` (pl. `http://192.168.1.72:8080`)
3. Leállítás: a Terminálban `Ctrl + C`

Fontos: a tesztcímen tárolt adatok **nem kerülnek át** automatikusan a végleges
címre. Átköltözéskor használd a „Biztonsági mentés letöltése” és „Mentés visszatöltése” gombot.

### Kivonat ellenőrzése fejlesztéskor
`npm run check -- "<kivonat.pdf>"`: csak összesítést ír ki, egyedi tételeket nem.

---

### Az app címe és frissítése (GitHub Pages)
- **Az app címe:** https://tzsolt95.github.io/family-budget/
- **A kód helye:** https://github.com/tzsolt95/family-budget (nyilvános: a kód és ez a leírás
  bárki számára látható, de **pénzügyi adat nincs benne**: azok csak a telefonon tárolódnak).
- **Frissítés:** a módosítás után Claude elmenti (commit), majd a Terminálban:
  `git push` – kb. 1 perc múlva az új változat elérhető.
- A bankkivonatok (PDF) és a mentésfájlok a `.gitignore` miatt **soha nem kerülnek fel**.

---

## 11. Napló

- **2026. 10. 12. – 1. lépés kész:** CIB PDF feltöltése, tételek listázása havonta,
  automatikus kategória, kategória átírása („mindig ezt használd”), duplikált feltöltés kiszűrése,
  biztonsági mentés / visszatöltés / törlés. A három szeptemberi kivonat mind a 213 tétele
  hibátlanul beolvasva, az egyenlegek centre egyeznek.
- **2026. 10. 12. – kiegészítés:** kártyák neve (ki fizetett), Revolut feltöltés címke,
  automatikus megtakarítások napi összevonása (szeptemberben 209 sor helyett 153).
- **2026. 10. 14. – Új ikon:** barna bőr pénztárca kártyával (a 4 javaslatból a „C”).
- **2026. 10. 14. – 2. fázis élesben:** Supabase beállítva (séma, engedélyezési lista, Gmail SMTP, kódos e-mail sablon).
  Támadási tesztek a valódi adatbázison: bejelentkezés nélkül olvasás/írás ❌ elutasítva, ismeretlen e-mail-cím
  regisztrációja ❌ elutasítva. Zsolt és a feleség is sikeresen belépett, mindkét telefonon ugyanazok az adatok,
  az élő szinkron (felvétel és törlés a másik telefonon) működik. Új regisztráció kikapcsolva.
- **2026. 10. 13–14. – 2. fázis (app oldal) kész:** belépés e-mail-kóddal, offline működés és szinkronizálás,
  adatbázis-séma biztonsági szabályokkal, magyar beállítási útmutató. 16 szimulált szinkron-teszt sikeres.
- **2026. 10. 13. – Kártyák:** kártya hozzáadása kézzel (utolsó 4 számjegy + név), kézzel felvett kártya törlése;
  a Kártyák rész akkor is látszik, ha még nincs kártya.
- **2026. 10. 13. – Baba kategória:** új 👶 Baba kategória (boltok, blokk-tételek, kártyakód),
  kivételekkel; induláskor a régebbi automatikus besorolások is frissülnek.
- **2026. 10. 13. – „PDF import” átnevezés:** az Importálás fülön „Bankszámlakivonat (PDF)”;
  az app magától felismeri a bankot (jelenleg: CIB), új bank egy új fájllal hozzáadható.
- **2026. 10. 13. – 5. lépés kész:** „Kimutatás” fül: összesítő kártyák az előző hónaphoz mérve,
  kiadások kategóriánként (blokkok tételenként), bevétel/kiadás hónaponként táblázattal,
  külön megtakarítás szakasz.
- **2026. 10. 13. – 3. lépés kész:** blokk beillesztése (Élő szöveg), automatikus felismerés,
  ellenőrző képernyő, tételenkénti kategória memóriával, kártyás blokk ↔ banki tétel összekapcsolás
  és megosztás kategóriák szerint.
- **2026. 10. 13. – 2. lépés kész:** kézi bevitel (+ gomb), készpénz / kártya, havonta ismétlődő tételek,
  automatikus összekapcsolás a banki tétellel, ⚠️ jelzés ha nincs meg a kivonaton, ATM-készpénzfelvétel
  külön címkével (nem kiadás).
- **2026. 10. 13. – az app élesben:** feltöltve a GitHubra (`tzsolt95/family-budget`),
  és elérhető a https://tzsolt95.github.io/family-budget/ címen.

---

## 12. Nyitott kérdések

- [x] A megtakarítás nem számít kiadásnak, de külön szakaszt kap. *(megerősítve)*
- [x] A grafikonok javasolt listája elfogadva. *(megerősítve)*
- [x] Supabase: **„Allow new users to sign up” kikapcsolva** (ellenőrizve: 2026. 10. 14.).
- [ ] Valódi blokkszövegek (SPAR/Tesco/Lidl + egy kis bolt) a blokkolvasó pontosításához.
- [x] Tárhely: **GitHub Pages**, nyilvános tárolóval (repo). *(döntés: 2026. 10. 13.)*
- [x] Két kártya van a számlán: az egyik Zsolté, a másik a feleségéé. A neveket az appban,
  az Importálás fülön a **Kártyák** résznél kell beírni (a kártyaszámok szándékosan nincsenek a kódban).
  A **Kártyák** lista a feltöltött kivonatokból töltődik fel, vagy **kézzel** bővíthető
  („+ Kártya hozzáadása kézzel”: utolsó 4 számjegy + név); a kézzel felvett kártya törölhető.
  Minden kártyaadat **csak a telefonon** tárolódik (ellenőrizve: a nyilvános kódban és a weboldalon nincs kártyaszám).
- [x] A Revolut feltöltés **kiadásnak** számít („Revolut feltöltés”, Egyéb kategória).
  Később jöhet a Revolut kivonatok importálása is, de egyelőre csak CIB.
- [x] Az apró automatikus megtakarítások naponta **egy sorba** vannak összevonva
  („Automatikus megtakarítás, N db utalás”). Az összegek nem változnak.

---

## 13. Következő lépés

~~1. lépés: a CIB PDF feltöltése, és a tranzakciók listázása javasolt kategóriákkal.~~ ✓ kész

~~2. lépés: Kézi bevitel (készpénz, előfizetés)~~ ✓ kész

Utána sorban:
3. ~~Blokk beillesztése és tételekre bontása~~ ✓ kész
4. ~~Párosítás: blokk ↔ banki tétel~~ ✓ kész (a 3. lépéssel együtt)
5. ~~Hó végi grafikonok~~ ✓ kész
6. ~~Mentés/exportálás~~ ✓ kész (az 1. lépéssel együtt)
7. ~~Feltöltés tárhelyre~~ ✓ kész, telepítés az iPhone-ra
8. ~~2. fázis: Supabase, közös használat a feleséggel~~ ✓ kész
9. Később: Revolut kivonatok importálása

**Lehetséges következő ötletek (még nincs döntés):**
- Havi keret (költségkeret) kategóriánként, figyelmeztetéssel
- Ki mennyit költött (Zsolt / feleség / közös) a kimutatásban
- Face ID / PIN zár az app megnyitásakor
- A blokkolvasó pontosítása valódi blokkszövegekkel
- Emlékeztető a havi biztonsági mentésre

---

## Hogyan folytasd később?

Nyiss egy új beszélgetést Claude Code-ban ebben a mappában, és írd például:

> „Olvasd el a PROJEKT_LEIRAS.md fájlt, és folytassuk a családi költségvetés appot.”
