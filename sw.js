// Richtschnur Service Worker: App-Shell für den Start ohne Netz (z. B. „Heute“ im Keller ohne Empfang).
// In den Cache kommen NUR die App-Shell (index.html) und statische Dateien des Builds (JS, Schriften, Symbole) – gleiche Herkunft, nur GET.
// Datenabrufe (Supabase-API, Speicher, Edge Functions) laufen nie durch diesen Cache: andere Herkunft → wird gar nicht angefasst.
// Version und Dateiliste setzt scripts/pwa.js beim Build ein; ohne Build (Entwicklung) ist der Worker untätig.
const VERSION = "b8e5d2128a03b0af";
const DATEIEN = ["/_expo/static/js/web/entry-dcc6b514846d17306dd82f9f2bf0ee9a.js","/assets/node_modules/@expo-google-fonts/bricolage-grotesque/500Medium/BricolageGrotesque_500Medium.1363130c7bdf956d164cb7e605619849.ttf","/assets/node_modules/@expo-google-fonts/bricolage-grotesque/600SemiBold/BricolageGrotesque_600SemiBold.e5b5fc505484ff3ca24da73cba67c660.ttf","/assets/node_modules/@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.2f7de7a336f650f9cee5ed919cc3b003.ttf","/assets/node_modules/@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.5bfb4fa1f8907c768231d97bc27e8df9.ttf","/assets/node_modules/@expo-google-fonts/nunito-sans/400Regular/NunitoSans_400Regular.9a446df4acd337a0803b98608aab1e66.ttf","/assets/node_modules/@expo-google-fonts/nunito-sans/500Medium/NunitoSans_500Medium.fbd0884ddc5d2f3099b41283cc8f2f7d.ttf","/assets/node_modules/@expo-google-fonts/nunito-sans/600SemiBold/NunitoSans_600SemiBold.58a08cfbaf11a92ef3aaf80e768a16ad.ttf","/assets/node_modules/@expo-google-fonts/nunito-sans/700Bold/NunitoSans_700Bold.d16d2c478d30947f35321066f798de6c.ttf","/assets/node_modules/@expo-google-fonts/nunito-sans/800ExtraBold/NunitoSans_800ExtraBold.08d068a6a911ec141fac7d6886d83817.ttf","/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf","/assets/node_modules/expo-router/assets/arrow_down.017bc6ba3fc25503e5eb5e53826d48a8.png","/assets/node_modules/expo-router/assets/error.d1ea1496f9057eb392d5bbf3732a61b7.png","/assets/node_modules/expo-router/assets/file.19eeb73b9593a38f8e9f418337fc7d10.png","/assets/node_modules/expo-router/assets/forward.d8b800c443b8972542883e0b9de2bdc6.png","/assets/node_modules/expo-router/assets/pkg.ab19f4cbc543357183a20571f68380a3.png","/assets/node_modules/expo-router/assets/react-navigation/elements/back-icon-mask.0a328cd9c1afd0afe8e3b1ec5165b1b4.png","/assets/node_modules/expo-router/assets/react-navigation/elements/back-icon.35ba0eaec5a4f5ed12ca16fabeae451d.png","/assets/node_modules/expo-router/assets/react-navigation/elements/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55.png","/assets/node_modules/expo-router/assets/react-navigation/elements/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@2x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@3x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/clear-icon.c94f6478e7ae0cdd9f15de1fcb9e5e55@4x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/close-icon.808e1b1b9b53114ec2838071a7e6daa7.png","/assets/node_modules/expo-router/assets/react-navigation/elements/close-icon.808e1b1b9b53114ec2838071a7e6daa7@2x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/close-icon.808e1b1b9b53114ec2838071a7e6daa7@3x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/close-icon.808e1b1b9b53114ec2838071a7e6daa7@4x.png","/assets/node_modules/expo-router/assets/react-navigation/elements/search-icon.286d67d3f74808a60a78d3ebf1a5fb57.png","/assets/node_modules/expo-router/assets/sitemap.412dd9275b6b48ad28f5e3d81bb1f626.png","/assets/node_modules/expo-router/assets/unmatched.20e71bdf79e3a97bf55fd9e164041578.png","/favicon.ico","/icons/apple-touch-icon.png","/icons/favicon-32.png","/icons/icon-192.png","/icons/icon-512.png","/icons/icon-maskable-512.png","/icons/icon.svg","/manifest.webmanifest"];
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

if (typeof module !== 'undefined') module.exports = { strategie };

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

  self.addEventListener('fetch', (e) => {
    if (!AKTIV) return;
    const r = e.request;
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
