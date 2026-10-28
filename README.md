# Nymo – Website

Statische Landingpage für die Nymo-App: reines HTML, CSS und JavaScript, keine Abhängigkeiten,
kein Build-Schritt, nichts von fremden Servern. Sprache wie die App: Englisch.

## Ansehen

Die Seite braucht einen kleinen lokalen Server (Browser laden Schriften nicht direkt von `file://`):

```powershell
cd D:\projects\NymoWebsite
npx serve .
```

Alternativ `python -m http.server 8000` oder in VS Code die Erweiterung „Live Server“.

## Aufbau

```
index.html                alle Abschnitte
child-safety.html         Kinderschutz-Standards (Pflicht für Google Play, ohne JavaScript)
assets/css/nymo.css       Design-Tokens (oben), Layout, App-Screens, Textseiten; unten „Motion & 3D (v2)“
assets/js/nymo-core.js    Bewegungs-Grundlage: ein Animations-Takt, Smooth Scroll, Scroll-Szenen,
                          Text-Zerlegung, Cursor, magnetische Buttons
assets/js/nymo-gl.js      WebGL ohne Bibliothek: der Punkte-Globus (Hero) und das 3D-Logo (Schluss)
assets/js/nymo.js         Seitenlogik: Intro, Globus, Handy, Datenfilter-Demo, Lösch-Story, FAQ …
assets/fonts/             Geist + Geist Mono (aus der App, als WOFF2, nur lateinische Zeichen) + OFL.txt
assets/img/               favicon.svg, favicon-32.png, apple-touch-icon.png, og-image.png (Link-Vorschau)
_versions/                Sicherungen früherer Stände (nicht mit hochladen, siehe „Hosten“)
```

Die drei Skripte werden in dieser Reihenfolge geladen (`defer`): `nymo-core.js` → `nymo-gl.js` → `nymo.js`.

## Was sich bewegt (v2)

| Abschnitt | Animation |
|---|---|
| Intro | Wie die App: „Finding someone for you…“, dann „You’re connected.“ – Punkt und Ring fliegen ins Logo der Navigation. Läuft einmal pro Sitzung. |
| Hero | 3D-Globus aus Punkten, Verbindungen als gepunktete Bögen mit „you“ / „someone, somewhere“. Mit der Maus ziehen, auf dem Handy wischen. Überschrift baut sich Buchstabe für Buchstabe in 3D auf. |
| Manifest | Der Text leuchtet beim Scrollen Wort für Wort auf. |
| How it works | Das Handy dreht sich beim Hereinscrollen in 3D in Position, folgt leicht der Maus, Licht gleitet übers Glas. |
| Band | Laufschrift, wird beim schnellen Scrollen schneller und neigt sich. |
| Datenfilter | Name und Stadt in der Überschrift werden durchgewürfelt und schließen sich zu grauen Balken. In der Demo zerfällt Erkanntes zu Staub, bevor der Balken kommt. |
| Nothing lingers | Das weiße Blatt fährt hoch wie das Bottom-Sheet der App. Danach bleibt die Geschichte einer Nachricht stehen, während man scrollt: gesendet → gefiltert → Chat endet → 60-Minuten-Countdown → die Nachricht zerfällt. |
| Navigation | Wird über dem weißen Blatt hell. |
| FAQ, Regeln, Tabelle, „Free to talk“ | Weiches Auf- und Zuklappen, Einblenden beim Scrollen. |
| Schluss | Das Logo in 3D: Porzellankugel und Chromring gleiten zusammen, reagieren auf die Maus. |
| Footer | „nymo“ steigt aus dem Boden, ein Lichtstreif läuft darüber. |
| Überall (Desktop) | Weiches Scrollen mit dem Mausrad, Cursor aus Punkt und Ring (beim Klicken berühren sie sich wie im Logo), magnetische Buttons. |

**Rückfallebenen:** Mit „Bewegung reduzieren“ im System gibt es kein Intro, keine Scroll-Effekte und
alles steht ruhig und vollständig da. Ohne WebGL kommt das Punktfeld aus v1 und das Logo als SVG.
Ohne JavaScript ist alle Information trotzdem lesbar.

**Intro noch einmal sehen:** Es läuft einmal pro Browser-Tab-Sitzung. Zum erneuten Ansehen den Tab
schließen und neu öffnen. Ein Link mit Anker (z. B. `…/#faq`) überspringt es immer.

## Vor dem Livegang

1. **Kontakt-Adresse**: `support@example.com` ist ein Platzhalter. In `index.html` und
   `child-safety.html` mit „Suchen und Ersetzen“ gegen deine echte Adresse tauschen (dieselbe wie in
   der App, `NymoLinks.kt`).
2. **Google-Play-Link**: steht in `assets/js/nymo.js` ganz oben (`STORE_URL`) und als Fallback in
   den `href`s mit `data-store` in `index.html`. Derzeit `…?id=app.nymo` – anpassen, falls sich die
   `applicationId` ändert. Bis die App veröffentlicht ist, führt der Link ins Leere.
3. **Kinderschutz-Seite**: Google Play verlangt sie für Apps mit anonymen Chats. Die Adresse
   (`https://deine-domain/child-safety.html`) in der Play Console unter **App-Inhalte →
   Kinderschutzstandards** eintragen, dazu Name und E-Mail der Ansprechperson. Was dort versprochen
   wird (Meldungen prüfen, sperren, an Behörden melden), steht als Ablauf in
   `../AnonymousChat/firebase/README.md`, Abschnitt „Meldungen, Sperren und Kinderschutz“. Vor dem
   Livegang am besten rechtlich gegenlesen lassen.
4. **Impressum und Datenschutzerklärung** fehlen noch (in Österreich Pflicht). Im Footer ist die Stelle
   als Kommentar markiert. Für die Datenschutzerklärung: Tabelle „Was gespeichert wird“ in
   `../AnonymousChat/firebase/README.md`.
5. **Link-Vorschau**: `og:image` in `index.html` auf die volle URL setzen, sobald die Domain feststeht
   (z. B. `https://deine-domain/assets/img/og-image.png`).
6. **Serverstandort**: Der Abschnitt „Nothing lingers“ nennt Frankfurt – stimmt, solange Functions und
   Firestore in `europe-west3` laufen.

## Woher die Installationen kommen

Jeder Google-Play-Link trägt einen UTM-Vermerk (`data-store="hero"`, `"nav"`, `"menu"`,
`"closing"`, `"footer"`), z. B. `…&referrer=utm_source%3Dnymo-website%26utm_medium%3Dhero…`. Google
Play wertet ihn aus: Play Console → **Statistiken** bzw. **Nutzerakquisition** → Kanal „Tracked
channels (UTM)“. Die Website selbst speichert dafür nichts und setzt keine Cookies.

## „Free to talk. Here’s how.“ (`#free`)

Erklärt, wie sich Nymo finanziert: Chats und Sicherheit immer gratis, keine Werbung, keine
Datenverkäufe, Unterstützer-Käufe in der App, Nymo Plus „Later“ und Nymo für Hochschulen mit
„Talk to us“ (Mail an die Kontakt-Adresse). Sobald Nymo Plus eingeschaltet ist
(`config plusEnabled=true`, siehe Firebase-README), bei Plus „Later“ in „Now“ ändern und den Punkt
füllen (`plan__dot--on`), im FAQ „Optional extras may come later as Nymo Plus“ anpassen.

## Inhalte, die an der App hängen

- Die Tabelle „Nothing lingers“ (`#privacy`) und die Kinderschutz-Seite beschreiben, was die App und
  der Server speichern und tun. Ändert sich dort etwas (z. B. Bilder im Chat, neue Daten), beide
  Seiten nachziehen.
- Zeiten (30 min Ruhe → Chat endet, 60 min nach Ende gelöscht, 24 h, 30 s Ausweichregel) stammen aus
  `firebase/functions/src/config.ts`. Ändern sich die Werte, im Abschnitt `#privacy` (Story und Tabelle)
  und im FAQ nachziehen.
- Die Demo nutzt dieselben Regeln wie `PrivacyFilter.kt` und `functions/src/privacyFilter.ts`
  (Funktion `createPrivacyFilter` in `nymo.js`, gegen alle Server-Testfälle geprüft). Bei Änderungen am
  Filter dort mitziehen.
- Die Handy-Screens sind aus den App-Entwürfen nachgebaut (HTML/CSS im Abschnitt `#how`).

## Hosten

Jeder statische Host geht. Passend zum Backend: Firebase Hosting –
im Ordner `firebase init hosting` ausführen, als Public-Verzeichnis `.` angeben. In `firebase.json`
die Sicherungen und diese Datei ausschließen:

```json
"ignore": ["firebase.json", "**/.*", "_versions/**", "README.md"]
```

Dann `firebase deploy --only hosting`.

Die Seite setzt keine Cookies und lädt nichts von fremden Servern (Schriften sind selbst gehostet).
Der Intro-Merker liegt nur im `sessionStorage` des Tabs und verschwindet mit ihm.

## Versionen

- `_versions/v1-2026-10-26/` – der erste Stand (ohne 3D und Animationen), vollständig lauffähig.
- `_versions/v2-2026-10-27/` – v2 mit 3D und Animationen, vor „Free to talk“, Kinderschutz-Seite
  und UTM-Links.
