// Build inserts the immutable static-file list and version. Never cache vaults,
// exports, OAuth responses or arbitrary network requests here.
const FILES = [{"path":"assets/app-B3D4IooU.js","integrity":"sha256-tYRk4JI8o+BBbu3+Ea45xeHBUmnAS6LhHZWGa/FJ+gM="},{"path":"assets/auth-DbKJctBG.js","integrity":"sha256-O556bmipNX7QqSWXMEZPtSi6N6ov3gv8LLi2pLk71xY="},{"path":"assets/autoPreference-COjQg5e3.js","integrity":"sha256-tH2gdi4HaRX8giFE1gYQnaW/S/JUT3SmnK3IQvJ86YU="},{"path":"assets/drive-pKrMTNc_.js","integrity":"sha256-IerVleS329gh9uEnp8GwGRj1BaQd/X35vQBH9uMVJQI="},{"path":"assets/driveHandoff-D1DSqhZW.js","integrity":"sha256-TPsiovITrlinRASX0QG4xnDS7Scpe7TPGd8oOo6mqFc="},{"path":"assets/kdf.worker-sVQUwJ7p.js","integrity":"sha256-vKZ4I+CHfJ/YpwCFHZWF57ScWVlH48OYNQhMjFOfvl8="},{"path":"assets/strength.worker-B9YFkIJ4.js","integrity":"sha256-we950/ZsiSQKT2IvD0Mu+MN83EoWAxnpXEUBMISZVHA="},{"path":"assets/styles-BMnv1Wwa.css","integrity":"sha256-xDfgDLfXckkn5WYOHcNQajkwGayWffy/XC0eHoImH6E="},{"path":"assets/styles-DWKn9TGH.js","integrity":"sha256-USZPpIdG41YdOCpSCR9wL/wwvZt/+rrKek8yrgUSeEo="},{"path":"auth.html","integrity":"sha256-QFGkcBIcctEtFsgkNdZC521N3m4+pDeHSNSoO/FEoA8="},{"path":"drive.html","integrity":"sha256-GE7skVt+7Y+HolROmBHhdT628ShLASbog9EjMHIbpjg="},{"path":"favicon.svg","integrity":"sha256-K2xDO20L0B1KzQIWmpQLASZtyFrjGFm+57wIe3aEJIo="},{"path":"icons/apple-touch-icon.png","integrity":"sha256-8XIYBuuSNyRCfsa+ONBHVCvbqvVF6wRyKFwkcXx9LTc="},{"path":"icons/icon-192.png","integrity":"sha256-E4U8Nw8qKegiItpNM7ab/GNPgYUVzXcvl6t6a331JPg="},{"path":"icons/icon-512.png","integrity":"sha256-sSamrGcY2Drrvy3lvdDEc2h8xwEJCwz3O8OckLEn8g8="},{"path":"icons/maskable-512.png","integrity":"sha256-sSamrGcY2Drrvy3lvdDEc2h8xwEJCwz3O8OckLEn8g8="},{"path":"index.html","integrity":"sha256-DFpTOtQNnHv2W4g2l4PCZVP5seonIFMxLaeOCKg6SSg="},{"path":"manifest.webmanifest","integrity":"sha256-d7j+7VL2FzZSvwvkDYndy3/AekG/BqmIdC2FMnUfeGI="}];
const VERSION = "GYqDBULX4EHz7rraf2xU";
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
