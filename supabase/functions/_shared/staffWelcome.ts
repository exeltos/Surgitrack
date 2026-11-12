import {esc, layout, usernameBox} from "./mail.ts";

// The email each person gets from the owner's staff import, at their own address: their username and what to do at
// the first sign-in. It carries NO link (not even a button): a message that sends people to a page to type a password
// is exactly what a phishing email looks like, so they are told to open SurgiTrack the way they always do. And it
// never carries the password: the initial one is the mobile number the hospital has, which it only names.

const athensDate = (iso: string) =>
  new Intl.DateTimeFormat("el-GR", {timeZone: "Europe/Athens", day: "2-digit", month: "2-digit", year: "numeric"}).format(
    new Date(iso),
  );

export const welcomeEmail = (d: {hospital: string; userCode: string; deadline: string | null; reminder?: boolean}) => ({
  subject: `${d.reminder ? "Υπενθύμιση: " : ""}Ο λογαριασμός σας στο SurgiTrack · ${d.hospital}`,
  html: layout(
    "ΝΕΟΣ ΛΟΓΑΡΙΑΣΜΟΣ",
    "Ο λογαριασμός σας στο SurgiTrack",
    `${d.reminder ? `<p><b>Υπενθύμιση:</b> δεν έχετε ακόμη κάνει την πρώτη σας σύνδεση ούτε ορίσει δικό σας κωδικό.</p>` : ""}<p>Το <b>${esc(d.hospital)}</b> δημιούργησε λογαριασμό για εσάς στο SurgiTrack. Αυτό είναι το όνομα χρήστη σας:</p>
     ${usernameBox(d.userCode)}
     <p><b>Στην πρώτη σας σύνδεση:</b></p>
     <ol style="padding-left:20px;margin:0 0 14px">
       <li>Ανοίξτε το SurgiTrack με τον τρόπο που το ανοίγετε συνήθως και, στην οθόνη σύνδεσης, γράψτε το <b>όνομα χρήστη</b> παραπάνω (όχι το email σας).</li>
       <li>Ως <b>αρχικό κωδικό</b> γράψτε τον <b>αριθμό του κινητού σας τηλεφώνου</b>, μόνο ψηφία, όπως τον έχει δηλώσει το νοσοκομείο.</li>
       <li>Αμέσως μετά θα σας ζητηθεί να ορίσετε <b>δικό σας κωδικό</b>. Πρέπει να έχει <b>τουλάχιστον 10 χαρακτήρες, με ένα γράμμα και έναν αριθμό</b>, και να μην είναι κάποιος πολύ κοινός κωδικός. Δεν γίνεται δεκτός κωδικός με μόνο ψηφία, άρα ούτε ο αριθμός του κινητού.</li>
       <li>Με τον νέο σας κωδικό συνεχίζετε κανονικά στην εφαρμογή. Την επόμενη φορά συνδέεστε με το όνομα χρήστη και τον νέο σας κωδικό.</li>
     </ol>
     ${
       d.deadline
         ? `<p>Η πρώτη σύνδεση και η αλλαγή του κωδικού πρέπει να γίνουν <b>μέχρι ${athensDate(d.deadline)}</b>. Μετά από αυτή την ημερομηνία ο λογαριασμός κλειδώνει και θα χρειαστεί να επικοινωνήσετε με τον διαχειριστή.</p>`
         : ""
     }
     <p>Μην μοιράζεστε τον κωδικό σας με κανέναν. Το SurgiTrack δεν θα σας ζητήσει ποτέ τον κωδικό σας με email. Αυτό το μήνυμα δεν περιέχει σύνδεσμο, επίτηδες.</p>`,
  ),
});
