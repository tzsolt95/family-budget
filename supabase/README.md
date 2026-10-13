# Közös használat beállítása (Supabase)

Ez a leírás egyszer kell: a felhő (Supabase) beállításához, hogy a két telefon ugyanazokat az adatokat lássa.
Minden lépést a Supabase weboldalán (https://supabase.com/dashboard) kell elvégezni, a `family-budget` projektben.

> ⚠️ A **secret** (`sb_secret_…`) kulcsot soha ne másold sehova. Ehhez a beállításhoz nincs rá szükség.

---

## 1. Az adatbázis létrehozása (egyszer)

1. Bal oldalt: **SQL Editor** → **New query**.
2. Másold be a `supabase/schema.sql` fájl **teljes** tartalmát.
3. Kattints a **Run** gombra. Ha a végén **„Success. No rows returned”** jelenik meg, kész.

Ez létrehozza a táblákat és a **biztonsági szabályokat** (csak a háztartás tagjai látják az adatokat,
bejelentkezés nélkül semmi nem olvasható, és csak az engedélyezett e-mail-címekkel lehet belépni).

---

## 2. A háztartás és a két e-mail-cím megadása (egyszer)

1. **SQL Editor** → **New query**.
2. Másold be az alábbit, és **írd át a két e-mail-címet** a sajátotokra (kisbetűvel):

```sql
with h as (
  insert into public.households (name) values ('Család') returning id
)
insert into public.allowed_emails (email, household_id)
select lower(e), h.id from h, unnest(array[
  'elso.cim@gmail.com',
  'masodik.cim@gmail.com'
]) as e;
```

3. **Run**. Az eredmény: **2 rows** (két sor felvéve).

Az e-mail-címek **csak a Supabase adatbázisba** kerülnek, a nyilvános kódba (GitHub) nem.
Ezt a lekérdezést **ne mentsd el** fájlba a projektben.

---

## 3. A belépési e-mail átírása kódra (egyszer)

Alapból a Supabase egy *linket* küld e-mailben. A főképernyőre tett iPhone-app ezzel nem jól működik,
ezért a levélben **kódot** küldünk.

1. Bal oldalt: **Authentication** → **Emails** (vagy **Email Templates**).
2. Nyisd meg a **Magic Link** sablont, és cseréld le:
   - **Subject (tárgy):** `Családi Kassza belépési kód`
   - **Body (tartalom):**

```html
<h2>Családi Kassza</h2>
<p>A belépési kódod:</p>
<h1 style="letter-spacing:4px">{{ .Token }}</h1>
<p>A kód rövid időn belül lejár. Ha nem te kérted, nyugodtan hagyd figyelmen kívül ezt a levelet.</p>
```

3. **Save**.
4. Ugyanezt csináld meg a **Confirm signup** sablonnal is (az első belépéskor ezt küldi).

⚠️ **Ingyenes csomagnál a sablon csak saját levelezővel (SMTP) szerkeszthető**, és a beépített levelező
csak a projekt tagjainak küld. Ezért a leveleket a saját Gmail-fiókunkon keresztül küldjük:
1. Google-fiók: **2 lépcsős azonosítás** bekapcsolása (https://myaccount.google.com/security).
2. **Alkalmazásjelszó** létrehozása „Supabase” néven (https://myaccount.google.com/apppasswords).
   Ezt a jelszót senkinek ne add ki; csak a Supabase-be kell beírni.
3. Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   Sender email és Username = a Gmail-cím, Sender name = `Családi Kassza`,
   Host = `smtp.gmail.com`, Port = `465`, Password = az alkalmazásjelszó → **Save**.
4. Ezután a sablonok szerkeszthetők.

**Ajánlott:** **Authentication → Providers (Sign In / Providers) → Email** alatt az
**Email OTP Expiration** legyen **600** (10 perc).

---

## 4. Belépés a telefonokon

1. Az appban: **Importálás** fül → **☁️ Közös használat** → e-mail-cím → **Belépési kód kérése**.
2. A levélben kapott kódot írd be → **Belépés**.
3. **Zsolt telefonja** az első belépéskor **feltölti** a meglévő adatokat.
   A **feleség telefonja** belépés után **letölti** őket.

A beépített Supabase levelező **óránként csak néhány levelet** küld. Ha nem jön kód, várj pár percet.

---

## 5. Utolsó zár: új regisztráció kikapcsolása (ha mindketten beléptetek)

Ha már **mindketten egyszer beléptetek**:

**Authentication → Providers (Sign In / Providers)** → kapcsold **ki** az
**„Allow new users to sign up”** opciót → **Save**.

Ettől kezdve **senki új nem tud fiókot létrehozni**, még engedélyezett e-mail-címmel sem.
(Ha később valakit fel kell venni, ezt ideiglenesen vissza lehet kapcsolni.)

---

## Ha baj van

| Hiba | Teendő |
|---|---|
| „Ez az e-mail-cím nincs engedélyezve” | Elírás lehet a 2. lépésben. **Table Editor → allowed_emails** táblában ellenőrizd. |
| „A fiókod még nincs háztartáshoz rendelve” | A cím fiókja a 2. lépés előtt jött létre. Szólj Claude-nak, egy rövid SQL megoldja. |
| Nem jön kód | Spam mappa; várj néhány percet (levélkorlát). |
| Az első levélben link van, nem kód | Ez az első regisztráció levele. Ne a linkre kattints: kérj az appban **új kódot**, a második levélben már kód lesz. |
| A projekt „paused” (szüneteltetve) | Hosszabb használaton kívüli idő után: a Supabase oldalán **Restore project**. |
| Elveszett telefon | Szólj Claude-nak: egy rövid SQL-lel az adott fiók összes belépése megszüntethető. Addig is a telefon zárolása véd. |
