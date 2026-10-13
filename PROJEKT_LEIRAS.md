# Családi költségvetés app – projektleírás

> Ez a dokumentum összefoglalja, mit és miért döntöttünk az app tervezésekor.
> Ha később módosítani szeretnéd az appot, először ezt olvasd el (vagy add oda Claude-nak),
> és onnan folytathatod a munkát.

**Létrehozva:** 2026. október 12.
**Állapot:** az 1. és 2. lépés kész (CIB PDF beolvasás, kézi bevitel). Következik: blokkok beillesztése.

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

**Kiadások:** Élelmiszer, Háztartás, Rezsi, Étterem/rendelés, Szórakozás, Közlekedés,
Előfizetések, Egészség, Ruházat, Hitel, Biztosítás, Egyéb

**Bevételek:** Fizetés, Visszatérítés, Kamat, Egyéb bevétel

**Megtakarítás:** Megtakarítás, Megtakarítás feloldása

A **Rezsi, Étterem/rendelés, Hitel és Biztosítás** kategória a valódi szeptemberi
kivonatok alapján került be (az eredeti 8-as listához képest), mert ezek gyakori,
nagy tételek voltak.

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

## 5. Hó végi kimutatás (grafikonok) – elfogadva

- **Összesítő kártyák:** összes bevétel, összes kiadás, megtakarítás, maradék pénz
- **Kiadások kategóriánként:** oszlopdiagram, a legnagyobb kategória elöl
- **Hónapok összehasonlítása:** bevétel és kiadás az elmúlt néhány hónapban
- **Megtakarítás alakulása:** mennyi ment be és mennyi jött ki

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
- **Chart.js:** ingyenes eszköz a grafikonokhoz.
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
| `app/js/cib-parser.js` | A CIB PDF kivonat beolvasása és ellenőrzése |
| `app/js/categories.js` | Kategóriák és a besorolási szabályok |
| `app/js/store.js` | Adatok mentése a telefonon, biztonsági mentés |
| `app/js/app.js` | A képernyők működése |
| `app/vendor/pdfjs/` | Ingyenes PDF-olvasó könyvtár (pdf.js) |
| `tools/check-statement.mjs` | Fejlesztői ellenőrzés: beolvas egy kivonatot, és megnézi, egyeznek-e az összegek |

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
- **2026. 10. 13. – 2. lépés kész:** kézi bevitel (+ gomb), készpénz / kártya, havonta ismétlődő tételek,
  automatikus összekapcsolás a banki tétellel, ⚠️ jelzés ha nincs meg a kivonaton, ATM-készpénzfelvétel
  külön címkével (nem kiadás).
- **2026. 10. 13. – az app élesben:** feltöltve a GitHubra (`tzsolt95/family-budget`),
  és elérhető a https://tzsolt95.github.io/family-budget/ címen.

---

## 12. Nyitott kérdések

- [x] A megtakarítás nem számít kiadásnak, de külön szakaszt kap. *(megerősítve)*
- [x] A grafikonok javasolt listája elfogadva. *(megerősítve)*
- [x] Tárhely: **GitHub Pages**, nyilvános tárolóval (repo). *(döntés: 2026. 10. 13.)*
- [x] Két kártya van a számlán: az egyik Zsolté, a másik a feleségéé. A neveket az appban,
  az Importálás fülön a **Kártyák** résznél kell beírni (a kártyaszámok szándékosan nincsenek a kódban).
- [x] A Revolut feltöltés **kiadásnak** számít („Revolut feltöltés”, Egyéb kategória).
  Később jöhet a Revolut kivonatok importálása is, de egyelőre csak CIB.
- [x] Az apró automatikus megtakarítások naponta **egy sorba** vannak összevonva
  („Automatikus megtakarítás, N db utalás”). Az összegek nem változnak.

---

## 13. Következő lépés

~~1. lépés: a CIB PDF feltöltése, és a tranzakciók listázása javasolt kategóriákkal.~~ ✓ kész

~~2. lépés: Kézi bevitel (készpénz, előfizetés)~~ ✓ kész

Utána sorban:
3. **Blokk beillesztése és tételekre bontása** ← következik
4. Párosítás: blokk ↔ banki tétel (a kézi tétel ↔ banki tétel párosítás már kész)
5. Hó végi grafikonok
6. ~~Mentés/exportálás~~ ✓ kész (az 1. lépéssel együtt)
7. ~~Feltöltés tárhelyre~~ ✓ kész, telepítés az iPhone-ra
8. 2. fázis: Supabase, közös használat a feleséggel
9. Később: Revolut kivonatok importálása

---

## Hogyan folytasd később?

Nyiss egy új beszélgetést Claude Code-ban ebben a mappában, és írd például:

> „Olvasd el a PROJEKT_LEIRAS.md fájlt, és folytassuk a családi költségvetés appot.”
