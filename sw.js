// Build inserts the immutable static-file list and version. Never cache vaults,
// exports, OAuth responses or arbitrary network requests here.
const FILES = [{"path":"assets/app-Cs6kSMCj.js","integrity":"sha256-SIG1Xub2Zc4dTTLjiuXJQ2IRObt//LeY33LTAZPb7eY="},{"path":"assets/auth-D1JxBSmx.js","integrity":"sha256-etdE4Q7Okk+6dLRXHoViMVJp+TNn5r2JvKQuRlW7TVE="},{"path":"assets/autoPreference-COjQg5e3.js","integrity":"sha256-tH2gdi4HaRX8giFE1gYQnaW/S/JUT3SmnK3IQvJ86YU="},{"path":"assets/drive-D62iaqTR.js","integrity":"sha256-oyN5pVWYYVOyvw9lGk13YFX9EgY4yKKw9XUiajw2tjw="},{"path":"assets/driveHandoff-CTKXHh4T.js","integrity":"sha256-4BjQVomkeDyWyX+vwUvabKMg9UOUnq7UmaZ2A6blQ0A="},{"path":"assets/kdf.worker-sVQUwJ7p.js","integrity":"sha256-vKZ4I+CHfJ/YpwCFHZWF57ScWVlH48OYNQhMjFOfvl8="},{"path":"assets/strength.worker-B9YFkIJ4.js","integrity":"sha256-we950/ZsiSQKT2IvD0Mu+MN83EoWAxnpXEUBMISZVHA="},{"path":"assets/styles-BPcfqdEq.js","integrity":"sha256-USZPpIdG41YdOCpSCR9wL/wwvZt/+rrKek8yrgUSeEo="},{"path":"assets/styles-BPEHkVWN.css","integrity":"sha256-IiU15lk3F/mG/6wQBX91inmbP4EjbTjdKw7vJV80t5g="},{"path":"auth.html","integrity":"sha256-jmZSb14xEYKreGISGnBknIIft7ZPesVbFRXAqnuOlTo="},{"path":"drive.html","integrity":"sha256-Phz+hqGNesDHW6J8bERDhlSpTzJld95Vl5x9p+aJUhU="},{"path":"favicon.svg","integrity":"sha256-K2xDO20L0B1KzQIWmpQLASZtyFrjGFm+57wIe3aEJIo="},{"path":"icons/apple-touch-icon.png","integrity":"sha256-8XIYBuuSNyRCfsa+ONBHVCvbqvVF6wRyKFwkcXx9LTc="},{"path":"icons/icon-192.png","integrity":"sha256-E4U8Nw8qKegiItpNM7ab/GNPgYUVzXcvl6t6a331JPg="},{"path":"icons/icon-512.png","integrity":"sha256-sSamrGcY2Drrvy3lvdDEc2h8xwEJCwz3O8OckLEn8g8="},{"path":"icons/maskable-512.png","integrity":"sha256-sSamrGcY2Drrvy3lvdDEc2h8xwEJCwz3O8OckLEn8g8="},{"path":"index.html","integrity":"sha256-oKetkV8tZyA2B+/FpdtA5bZRvUHuqa/EwZ4NhSMd8wE="},{"path":"manifest.webmanifest","integrity":"sha256-d7j+7VL2FzZSvwvkDYndy3/AekG/BqmIdC2FMnUfeGI="}];
const VERSION = "V8HTYZvxFukNJk2rtQ6p";
const scope = new URL(self.registration.scope);
const prefix = `vault-shell:${scope.pathname}:`;
const cacheName = prefix + VERSION;
const urls = new Map(
  FILES.map((file) => [new URL(file.path, scope).href, file]),
);
const shell = new URL("index.html", scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      // addAll is atomic: a missing or integrity-mismatched file rejects install.
      await cache.addAll(
        FILES.map(
          (file) =>
            new Request(new URL(file.path, scope), {
              cache: "reload",
              credentials: "same-origin",
              integrity: file.integrity,
            }),
        ),
      );
    })(),
  );
  // Deliberately no skipWaiting. Existing clients must close before an update
  // activates, so another tab cannot replace the app underneath an open editor.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(prefix) && name !== cacheName)
          await caches.delete(name);
      }
      // No clients.claim(): first setup asks for a reload from a locked screen.
      // No IndexedDB/localStorage access or deletion of vault data.
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== scope.origin) return;
  let target = url.href;
  if (
    request.mode === "navigate" &&
    (url.pathname === scope.pathname ||
      url.pathname === new URL(shell).pathname)
  ) {
    target = shell;
  } else if (!urls.has(target)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(target);
      if (cached) return cached;
      // An evicted file can only be repaired with the bytes from THIS build.
      const file = urls.get(target);
      const response = await fetch(
        new Request(target, {
          integrity: file.integrity,
          cache: "reload",
          credentials: "same-origin",
        }),
      );
      if (!response.ok)
        throw new Error("Offline application file unavailable.");
      await cache.put(target, response.clone());
      return response;
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "VAULT_OFFLINE_STATUS") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(cacheName);
        const present = await Promise.all(
          [...urls.keys()].map((url) => cache.match(url)),
        );
        event.ports[0]?.postMessage({
          ready: present.every(Boolean),
          version: VERSION,
        });
      })(),
    );
  }
});
