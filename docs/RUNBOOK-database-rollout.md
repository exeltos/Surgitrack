# Οδηγός εφαρμογής: αλλαγές ασφάλειας στη βάση (01/11/2026)

Αυτός ο οδηγός είναι για να βγουν **στην παραγωγή** οι αλλαγές ασφάλειας που έγιναν στο review (PR #242). Ο κώδικας της εφαρμογής έχει ήδη γίνει merge, αλλά η βάση (Supabase, project `oklyqnoqzbhjudqbkulq`) και οι edge functions **δεν έχουν αλλάξει ακόμα**. Ό,τι γράφει το repo δεν ισχύει μέχρι να εφαρμοστεί εκεί.

Κάθε βήμα έχει: τι κάνει, πώς το εφαρμόζεις, **πώς ελέγχεις ότι πέτυχε**, και **πώς γυρίζεις πίσω**. Αν ένας έλεγχος δεν βγει όπως γράφει, **σταμάτα** και μην πας στο επόμενο βήμα.

## Κατάσταση (01/11/2026)

Τα **βήματα 0 έως 4 έγιναν** στις 01/11/2026 και ο κάθε έλεγχος βγήκε όπως έπρεπε. Για το backup του βήματος 0 χρησιμοποιήθηκε το καθημερινό backup του ίδιου του Supabase (01/11 01:40 UTC), γιατί το νυχτερινό backup του GitHub **αποτυγχάνει** (λείπει το secret `SUPABASE_DB_URL`). **Μένει το βήμα 5** (απόκρυψη emails και usernames), όχι πριν περάσει μία μέρα χρήσης.

## Τι θα αλλάξει για τους χρήστες

| Αλλαγή                                          | Τι θα δουν                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Όριο αναφορών σφαλμάτων (60 την ώρα ανά χρήστη) | Τίποτα.                                                                                             |
| Μυστικό token επιβεβαίωσης εγγραφής κρυφό       | Τίποτα.                                                                                             |
| Νοσοκομείο με ληγμένο trial και φωτογραφίες     | Δεν ανεβάζει ούτε βλέπει φωτογραφίες, όπως ήδη ισχύει για τα υπόλοιπα δεδομένα του.                 |
| Λογαριασμοί admin μόνο από τον platform owner   | Ένας admin νοσοκομείου **δεν μπορεί πια** να αλλάξει, να επαναφέρει κωδικό ή να σβήσει άλλον admin. |
| Κρυφά emails και usernames συναδέλφων (staged)  | Οι απλοί χρήστες δεν βλέπουν emails και usernames των άλλων. Οι admin τα βλέπουν κανονικά.          |

## Βήμα 0: Πριν ξεκινήσεις

- [ ] Κάνε **backup τώρα**: GitHub → Actions → «Nightly backup» → «Run workflow». Περίμενε να γίνει πράσινο. (Τρέχει και μόνο του κάθε νύχτα στις 01:23 UTC.)
- [ ] Ανοίγεις την εφαρμογή στην παραγωγή και συνδέεσαι ως admin νοσοκομείου: η σελίδα «Χρήστες & Τμήματα» φορτώνει.
- [ ] Βεβαιώσου ότι το Netlify έχει βγάλει την τελευταία έκδοση του `main` (commit `06a2064` ή νεότερο).
- [ ] Διάλεξε ώρα με λίγη κίνηση. Τα βήματα 1–3 παίρνουν μερικά λεπτά.

Ποιος τα εφαρμόζει: **εσύ** (SQL Editor του Supabase ή CLI) ή **ο Claude, μόνο αν του πεις ρητά «τρέξε το βήμα Χ»**. Τα έως τώρα migrations εφαρμόζονταν με το εργαλείο `apply_migration` του Supabase.

> **Προσοχή με τα `drop`.** Τρία από τα αρχεία έχουν γραμμές `drop trigger if exists ...` ή `drop policy if exists ...`. Είναι φύλακες για αντικείμενα που δεν υπάρχουν ακόμα. Αν το εργαλείο κολλήσει σε αυτές (έχει συμβεί ξανά, δες `supabase/MIGRATIONS.md`), μπορείς να τις παραλείψεις: δεν υπάρχει τίποτα να σβηστεί.

## Βήμα 1: Τέσσερα ακίνδυνα migrations

Εφάρμοσέ τα με αυτή τη σειρά, από τον φάκελο `supabase/migrations/`:

1. `20261101203245_client_errors_rate_cap.sql`
2. `20261101203313_access_request_token_and_pending_email_guard.sql`
3. `20261101203341_trial_lock_storage.sql`
4. `20261101203352_profile_contacts_function.sql`

**Έλεγχος** (τρέξε στο SQL Editor, δεν αλλάζει τίποτα):

```sql
-- 1: το trigger υπάρχει
select tgname from pg_trigger where tgname = 'client_errors_rate_cap';              -- 1 γραμμή
-- 2: το μυστικό token δεν διαβάζεται από συνδεδεμένους χρήστες
select column_name from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'staff_access_requests'
   and grantee = 'authenticated' and column_name = 'confirm_token'
   and privilege_type = 'SELECT';                                                    -- 0 γραμμές
select tgname from pg_trigger where tgname = 'profiles_pending_email_guard';        -- 1 γραμμή
-- 3: η πολιτική για τα αρχεία υπάρχει
select policyname from pg_policies where policyname = 'trial_lock_assets';           -- 1 γραμμή
-- 4: η συνάρτηση υπάρχει
select proname from pg_proc where proname = 'profile_contacts';                      -- 1 γραμμή
```

**Έλεγχος στην εφαρμογή:** «Χρήστες & Τμήματα» φορτώνει με emails και usernames, και η λίστα εκκρεμών αιτημάτων φαίνεται κανονικά.

**Πίσω δρόμος** (αν κάτι δεν πάει καλά):

```sql
drop trigger if exists client_errors_rate_cap on public.client_errors;
drop function if exists public.client_errors_rate_cap();
drop index if exists public.client_errors_user_time_idx;

grant select on public.staff_access_requests to authenticated;
drop trigger if exists profiles_pending_email_guard on public.profiles;
drop function if exists public.profiles_pending_email_guard();

drop policy if exists trial_lock_assets on storage.objects;

drop function if exists public.profile_contacts(uuid);
```

## Βήμα 2: Έλεγχος ότι η νέα εφαρμογή δουλεύει με τη βάση

Η νέα έκδοση της εφαρμογής διαβάζει emails και usernames από τη συνάρτηση `profile_contacts`. Πριν προχωρήσεις, δοκίμασε στην παραγωγή:

- [ ] Admin νοσοκομείου: «Χρήστες & Τμήματα» δείχνει email κάτω από κάθε όνομα και στήλη «Όνομα χρήστη».
- [ ] Admin νοσοκομείου: «Προσθήκη χρήστη» (δεν χρειάζεται να στείλεις πραγματική πρόσκληση, αρκεί να ανοίξει η φόρμα).
- [ ] Platform owner: στο Studio, η καρτέλα χρηστών δείχνει emails, και το πάνελ Demo φορτώνει.
- [ ] Απλός χρήστης (π.χ. τμήματος): η εφαρμογή ανοίγει και δουλεύει κανονικά.

Αν κάποιο email λείπει, **σταμάτα**: σημαίνει ότι η συνάρτηση δεν επιστρέφει τα σωστά δεδομένα.

## Βήμα 3: Λογαριασμοί admin μόνο από τον platform owner

Αυτό έχει δύο μέρη που πρέπει να γίνουν μαζί:

**α) Το migration:** `20261101203835_admin_accounts_owner_only.sql`

**β) Οι τρεις edge functions** `update-staff`, `staff-link`, `delete-staff` (με CLI: `supabase functions deploy update-staff staff-link delete-staff --project-ref oklyqnoqzbhjudqbkulq`).

**Έλεγχος** (SQL, δεν αλλάζει τίποτα):

```sql
select policyname, qual like '%(role <> ''ADMIN''::surgi_role)%' as excludes_admins
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles'
   and policyname in ('profiles_update', 'profiles_delete');   -- και οι δύο γραμμές: t (true)
```

**Έλεγχος στην εφαρμογή** (χρειάζεσαι δύο λογαριασμούς admin στο ίδιο νοσοκομείο):

- [ ] Ως admin Α: στη γραμμή του admin Β εμφανίζεται κλείδωμα και δεν ανοίγει.
- [ ] Ως platform owner: ο admin Β ανοίγει και αλλάζει κανονικά.
- [ ] Ο admin Α εξακολουθεί να αλλάζει απλούς χρήστες.

**Πίσω δρόμος** για το migration (οι functions: ξανακάνε deploy την προηγούμενη έκδοση από το git):

```sql
alter policy profiles_update on public.profiles
  using (((select is_platform_admin()) or ((organization_id = (select current_org_id()))
    and ((select "current_role"()) = 'ADMIN'::surgi_role) and (id <> (select auth.uid())))));
alter policy profiles_delete on public.profiles
  using (((select is_platform_admin()) or ((organization_id = (select current_org_id()))
    and ((select "current_role"()) = 'ADMIN'::surgi_role) and (id <> (select auth.uid())))));
```

## Βήμα 4: Καταγραφή (μην το ξεχάσεις)

Τα αρχεία των migrations στο repo έχουν δικά μου timestamps. Μετά την εφαρμογή:

- [ ] Δες τις εκδόσεις που κατέγραψε το Supabase (`supabase migration list` ή Dashboard → Database → Migrations).
- [ ] Μετονόμασε τα 5 αρχεία ώστε να έχουν αυτές τις εκδόσεις.
- [ ] Στο `supabase/MIGRATIONS.md`, σβήσε την ενότητα «Not applied yet» και πρόσθεσε τα 5 στον πίνακα των εφαρμοσμένων.

Αν δεν μετονομαστούν, το nightly backup και το `supabase migration list` θα δείχνουν διαφορά ανάμεσα στο repo και στη βάση.

## Βήμα 5: Απόκρυψη emails και usernames από συναδέλφους (αργότερα)

Αυτό είναι το πιο ευαίσθητο βήμα και **δεν πρέπει να γίνει την ίδια μέρα**. Περίμενε τουλάχιστον μία μέρα από το βήμα 2, ώστε όλοι οι χρήστες να έχουν ανοίξει τη νέα έκδοση της εφαρμογής (ο service worker φέρνει νέες εκδόσεις με το πρώτο άνοιγμα με δίκτυο). Μια παλιά έκδοση που ακόμα διαβάζει τα πεδία από τον πίνακα θα έβγαζε σφάλμα «permission denied» στη σελίδα ανθρώπων.

1. Μετέφερε το αρχείο `supabase/staged/20261101100000_hide_profile_contacts.sql` στον φάκελο `supabase/migrations/` (με νέο όνομα/έκδοση) και εφάρμοσέ το.
2. **Έλεγχος** (SQL):

```sql
select column_name from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'profiles'
   and grantee = 'authenticated' and column_name in ('email', 'user_code')
   and privilege_type = 'SELECT';                                              -- 0 γραμμές
```

3. **Έλεγχος στην εφαρμογή:** ξανακάνε όλα τα σημεία του βήματος 2, και επιπλέον το πάνελ Demo και την είσοδο (σύνδεση με κωδικό).

**Πίσω δρόμος** (άμεσος, δεν χάνεται τίποτα):

```sql
grant select on public.profiles to authenticated;
```

## Αν κάτι πάει στραβά

1. **Μην πανικοβληθείς:** κάθε βήμα έχει πίσω δρόμο, και όλες οι αλλαγές είναι δικαιώματα και πολιτικές, δεν αγγίζουν τα δεδομένα.
2. Εκτέλεσε τον πίσω δρόμο του βήματος που μόλις έκανες.
3. Δες τον πίνακα σφαλμάτων στο Studio (`client_errors`) για το τι ακριβώς έσπασε.
4. Τα δεδομένα μπορούν να αποκατασταθούν από το backup του βήματος 0. Οι λογαριασμοί (`auth.users`) δεν είναι μέσα στο backup, και μετά από restore οι άνθρωποι μπαίνουν με νέο link επαναφοράς κωδικού.

## Πώς ελέγχθηκε αυτός ο οδηγός

Όλα τα SQL ελέγχου και οι «πίσω δρόμοι» δοκιμάστηκαν σε τοπική βάση Postgres 16, όπου ξαναπαίχτηκαν και τα 104 migrations (`bash supabase/tests/run-local.sh`): οι έλεγχοι δίνουν τα αποτελέσματα που γράφει ο οδηγός και ο κάθε πίσω δρόμος επαναφέρει την προηγούμενη κατάσταση. **Δεν δοκιμάστηκαν στη βάση της παραγωγής.**

## Τι ΔΕΝ καλύπτει αυτός ο οδηγός

- Throttle στο `device-ingest` και ακριβές CSP για το project (δεν έγιναν).
- Δεν έχει δοκιμαστεί σε staging: δεν ξέρω αν υπάρχει. Αν υπάρχει, κάνε τα βήματα 1–3 πρώτα εκεί.
- Οι έλεγχοι «στην εφαρμογή» χρειάζονται πραγματικούς λογαριασμούς. Αν δεν έχεις δύο admin στο ίδιο νοσοκομείο, φτιάξε προσωρινά έναν σε Demo.
