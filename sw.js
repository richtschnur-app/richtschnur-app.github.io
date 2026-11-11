// Richtschnur Service Worker: App-Shell für den Start ohne Netz (z. B. „Heute“ im Keller ohne Empfang).
// In den Cache kommen NUR die App-Shell (index.html) und statische Dateien des Builds (JS, Schriften, Symbole) – gleiche Herkunft, nur GET.
// Datenabrufe (Supabase-API, Speicher, Edge Functions) laufen nie durch diesen Cache: andere Herkunft → wird gar nicht angefasst.
// Version und Dateiliste setzt scripts/pwa.js beim Build ein; ohne Build (Entwicklung) ist der Worker untätig.
const VERSION = "327992d7666c76b4";
const DATEIEN = ["/_expo/static/js/web/entry-7ff47ec1e49b0a23c1ddba8aa09c712b.js","/assets/assets/schriften/RichtschnurSans-Bold.662fa8dc305ed9e12be321e461b30084.ttf","/assets/assets/schriften/RichtschnurSans-Regular.ba2fa2348946ea80fb3d5984802dc1f4.ttf","/assets/node_modules/@expo-google-fonts/bricolage-grotesque/500Medium/BricolageGrotesque_500Medium.1363130c7bdf956d164cb7e605619849.ttf","/assets/node_modules/@expo-google-fonts/bricolage-grotesque/600SemiBold/BricolageGrotesque_600SemiBold.e5b5fc505484ff3ca24da73cba67c660.ttf","/assets/node_modules/@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.2f7de7a336f650f9cee5ed919cc3b003.ttf","/assets/node_modules/@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.5bfb4fa1f8907c768231d97bc27e8df9.ttf","/assets/node_modules/@expo-google-fonts/nunito-sans/400Regular/NunitoSans_400Regular.9a446df4acd337a0803b98608aab1e66.ttf","/assets/node_modules/@expo-google-fonts/nunito-sans/500Medium/NunitoSans_500Medium.fbd0884ddc5d2f3099b41283cc8f2f7d.ttf","/assets/node_modules/@expo-google-fonts/nunito-sans/600SemiBold/NunitoSans_600SemiBold.58a08cfbaf11a92ef3aaf80e768a16ad.ttf","/assets/node_modules/@expo-google-fonts/nunito-sans/700Bold/NunitoSans_700Bold.d16d2c478d30947f35321066f798de6c.ttf","/assets/node_modules/@expo-google-fonts/nunito-sans/800ExtraBold/NunitoSans_800ExtraBold.08d068a6a911ec141fac7d6886d83817.ttf","/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf","/assets/node_modules/expo-router/assets/arrow_down.017bc6ba3fc25503e5eb5e53826d48a8.png","/assets/node_modules/expo-router/assets/error.d1ea1496f9057eb392d5bbf3732a61b7.png","/assets/node_modules/expo-router/assets/file.19eeb73b9593a38f8e9f418337fc7d10.png","/assets/node_modules/expo-router/assets/forward.d8b800c443b8972542883e0b9de2bdc6.png","/assets/node_modules/expo-router/assets/pkg.ab19f4cbc543357183a20571f68380a3.png","/assets/node_modules/expo-router/assets/react-navigation/elements/back-icon-mask.0a328cd9c1afd0afe8e3b1ec5165b1b4.png","/assets/node_modules/expo-router/assets/react-navigation/elements/back-icon.35ba0eaec5a4f5ed12ca16fabeae451d.png","/assets/node_modules/expo-router/assets/react-navigation/elements/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55.png","/assets/node_modules/expo-router/assets/react-navigation/elements/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@2x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@3x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@4x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/close-icon.808e1b1b9b53114ec2838071a7e6daa7.png","/assets/node_modules/expo-router/assets/react-navigation/elements/close-icon.808e1b1b9b53114ec2838071a7e6daa7@2x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/close-icon.808e1b1b9b53114ec2838071a7e6daa7@3x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/close-icon.808e1b1b9b53114ec2838071a7e6daa7@4x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/search-icon.286d67d3f74808a60a78d3ebf1a5fb57.png","/assets/node_modules/expo-router/assets/sitemap.412dd9275b6b48ad28f5e3d81bb1f626.png","/assets/node_modules/expo-router/assets/unmatched.20e71bdf79e3a97bf55fd9e164041578.png","/favicon.ico","/icons/apple-touch-icon.png","/icons/favicon-32.png","/icons/icon-192.png","/icons/icon-512.png","/icons/icon-maskable-512.png","/icons/icon.svg","/manifest.webmanifest"];
const PRAEFIX = 'richtschnur-shell-';
const CACHE = PRAEFIX + VERSION;
const AKTIV = !VERSION.startsWith('__');
const STATISCH = new Set(DATEIEN);

/**
 * Entscheidung je Anfrage (rein, ohne Seiteneffekte – getestet in tests/pwa.test.ts):
 * 'seite'  – Navigation: immer zuerst das Netz (direkte Links wie /k#t=… bekommen die echte Antwort, auch die 404.html
 *            von GitHub Pages); nur ohne Netz die zwischengespeicherte App-Shell.
 * 'datei'  – Datei dieses Builds: aus dem Cache, sonst Netz.
 * null     – nicht anfassen (fremde Herkunft, kein GET, alles andere).
 */
function strategie(methode, url, eigeneHerkunft, modus, statisch) {
  if (methode !== 'GET') return null;
  const u = new URL(url);
  if (u.origin !== eigeneHerkunft) return null;
  if (modus === 'navigate') return 'seite';
  return statisch.has(u.pathname) ? 'datei' : null;
}

// Teilen (Web Share Target, Manifest „share_target“ in scripts/pwa.js): Android schickt geteilten Text und Bilder als POST an /teilen.
// GitHub Pages nimmt kein POST an – der Worker fängt es ab, legt den Inhalt in einen eigenen Zwischenspeicher (nicht die App-Shell,
// nie Supabase) und leitet auf die Seite /teilen weiter, die ihn ausliest und danach löscht.
const TEILEN_CACHE = 'richtschnur-teilen';
const TEILEN_MAX_DATEIEN = 6;
const TEILEN_MAX_BYTES = 15 * 1024 * 1024;
const TEILEN_MAX_TEXT = 20000;
function istTeilen(methode, url, eigeneHerkunft) {
  if (methode !== 'POST') return false;
  const u = new URL(url);
  return u.origin === eigeneHerkunft && u.pathname === '/teilen';
}

/**
 * Kommt das Teilen vom Gerät (Teilen-Menü) oder von der App selbst? Fremde Webseiten dürfen nichts in den Zwischenspeicher legen.
 * Sec-Fetch-Site: nur „none“ (vom Betriebssystem/Browser) oder „same-origin“. Manche Browser zeigen dem Worker diese Kopfzeile
 * nicht – dann entscheidet der Verweis (Referrer): leer (Teilen-Menü) oder eigene Herkunft. [prüfen] Eine fremde Seite mit
 * „no-referrer“ fällt in diesem Rückfall nicht auf; deshalb speichert die Seite /teilen nie selbst, ein Mensch wählt den Auftrag.
 */
function teilenHerkunftOk(secFetchSite, referrer, eigeneHerkunft) {
  if (secFetchSite) return secFetchSite === 'none' || secFetchSite === 'same-origin';
  if (!referrer || referrer === 'about:client') return true;
  try {
    return new URL(referrer).origin === eigeneHerkunft;
  } catch {
    return false;
  }
}

/** Bildtyp an den ersten Bytes (JPEG, PNG, WebP; kein SVG) – gleich bildArt in src/domain/bild.ts */
function bildArt(b) {
  const at = (i, ...w) => w.every((x, j) => b[i + j] === x);
  if (b.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (b.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (b.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  return null;
}

/** Textfeld aus dem Formular: nur echte Zeichenketten (keine Datei unter „title“), gekürzt */
function textFeld(form, name) {
  const v = form.get(name);
  return typeof v === 'string' ? v.slice(0, TEILEN_MAX_TEXT) : '';
}

// Web Push (0027, P16): Anzeige und Klick. Die Nachricht kommt verschlüsselt vom Push-Dienst (supabase/functions/push-senden); hier nur
// anzeigen und beim Antippen die Ziel-Seite DIESER App öffnen – nie eine fremde Adresse. Nichts davon berührt den Cache.
/** Nutzlast → Anzeige (rein, getestet in tests/webpush.test.ts). Unlesbares wird zu einem neutralen Hinweis statt zu nichts. */
function pushAnzeige(text) {
  let d = {};
  try { d = JSON.parse(text || '{}') || {}; } catch { d = {}; }
  const s = (v, n, w) => (typeof v === 'string' && v.trim() ? v.slice(0, n) : w);
  return {
    titel: s(d.titel, 80, 'Richtschnur'),
    optionen: { body: s(d.text, 200, 'Es gibt Neuigkeiten.'), tag: s(d.tag, 64, 'rs-sammel'), icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', lang: 'de', data: { ziel: s(d.ziel, 200, '/benachrichtigungen') } },
  };
}
/** Ziel beim Antippen: nur ein Pfad dieser Herkunft (wie sicheresZiel in src/domain/benachrichtigung.ts), sonst die Glocke */
function klickZiel(ziel, herkunft) {
  const ok = typeof ziel === 'string' && /^\/[A-Za-z0-9/_?=&.%-]*$/.test(ziel) && !ziel.startsWith('//') && !ziel.includes('..') && ziel.length <= 200;
  const u = new URL(ok ? ziel : '/benachrichtigungen', herkunft);
  return u.origin === herkunft ? u.href : new URL('/benachrichtigungen', herkunft).href;
}

if (typeof module !== 'undefined') module.exports = { strategie, istTeilen, teilenHerkunftOk, bildArt, textFeld, TEILEN_CACHE, pushAnzeige, klickZiel };

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (e) => {
    self.skipWaiting();
    if (!AKTIV) return;
    // Einzeln laden: eine fehlende Datei verhindert nicht die ganze Installation
    e.waitUntil(caches.open(CACHE).then((c) => Promise.all(['/', ...DATEIEN].map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => undefined)))));
  });

  self.addEventListener('activate', (e) => {
    // Alte Builds löschen – es läuft immer nur der aktuelle Stand
    e.waitUntil((async () => {
      for (const k of await caches.keys()) if (k.startsWith(PRAEFIX) && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })());
  });

  self.addEventListener('message', (e) => {
    if (e.data && e.data.typ === 'cache-leeren') e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PRAEFIX)).map((k) => caches.delete(k)))));
  });

  self.addEventListener('push', (e) => {
    const a = pushAnzeige(e.data ? e.data.text() : '');
    e.waitUntil(self.registration.showNotification(a.titel, a.optionen));
  });

  self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const ziel = klickZiel(e.notification.data && e.notification.data.ziel, self.location.origin);
    e.waitUntil((async () => {
      // Offenes Fenster dieser App nach vorn holen und dorthin wechseln, sonst neues Fenster
      for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
        if (new URL(c.url).origin !== self.location.origin) continue;
        try { await c.focus(); if ('navigate' in c) await c.navigate(ziel); return; } catch { /* weiter mit neuem Fenster */ }
      }
      await self.clients.openWindow(ziel);
    })());
  });

  self.addEventListener('fetch', (e) => {
    const r = e.request;
    if (istTeilen(r.method, r.url, self.location.origin)) {
      e.respondWith((async () => {
        if (!teilenHerkunftOk(r.headers.get('sec-fetch-site'), r.referrer, self.location.origin)) return Response.redirect('/teilen?geteilt=fehler', 303);
        try {
          const form = await r.formData();
          const c = await caches.open(TEILEN_CACHE);
          for (const k of await c.keys()) await c.delete(k);
          const alle = form.getAll('dateien');
          const dateien = [];
          for (const d of alle) {
            if (typeof d === 'string' || d.size > TEILEN_MAX_BYTES || dateien.length >= TEILEN_MAX_DATEIEN) continue;
            const art = bildArt(new Uint8Array(await d.slice(0, 12).arrayBuffer()));
            if (art) dateien.push({ d, art });
          }
          for (const [i, x] of dateien.entries()) await c.put(`/teilen/datei/${i}`, new Response(x.d, { headers: { 'content-type': x.art } }));
          const daten = { title: textFeld(form, 'title'), text: textFeld(form, 'text'), url: textFeld(form, 'url'), dateien: dateien.length, verworfen: alle.length - dateien.length, am: new Date().toISOString() };
          await c.put('/teilen/daten', new Response(JSON.stringify(daten), { headers: { 'content-type': 'application/json' } }));
          return Response.redirect('/teilen?geteilt=1', 303);
        } catch {
          return Response.redirect('/teilen?geteilt=fehler', 303);
        }
      })());
      return;
    }
    if (!AKTIV) return;
    const art = strategie(r.method, r.url, self.location.origin, r.mode, STATISCH);
    if (art === 'seite') {
      // Die Shell im Cache stammt aus der Installation dieses Builds (passt zu dessen JS-Dateien); Netzantworten werden nicht gespeichert
      e.respondWith(fetch(r).catch(async () => (await caches.match('/', { cacheName: CACHE })) ?? Response.error()));
      return;
    }
    if (art !== 'datei') return;
    const pfad = new URL(r.url).pathname;
    e.respondWith(
      caches.match(pfad, { cacheName: CACHE }).then(
        (t) =>
          t ??
          fetch(r).then((antwort) => {
            if (antwort.ok) { const kopie = antwort.clone(); e.waitUntil(caches.open(CACHE).then((c) => c.put(pfad, kopie))); }
            return antwort;
          }),
      ),
    );
  });
}
