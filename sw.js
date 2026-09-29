// Build inserts the immutable static-file list and version. Never cache vaults,
// exports, OAuth responses or arbitrary network requests here.
const FILES = [{"path":"assets/app-D5GBg3ZV.js","integrity":"sha256-Ap9epI4uqGLGJut1Rv6iDsQGwvVTlxq9ipxkuW7TP7E="},{"path":"assets/app-DP6JJCJo.css","integrity":"sha256-X+ctw/Dy3nbGl3+RR9XxuxxFRe6OhnO/TA4T4l+vx48="},{"path":"assets/auth-ANJQxEFa.js","integrity":"sha256-nTKZV4MrfH8+7jqtFX16sbOQBZMd2KjGmC/BLsZnmXs="},{"path":"assets/autoPreference-CKDOuT5c.js","integrity":"sha256-BeQndHdHh4bNmYf/FaMnjet0qh27UpVhF++2h67szjU="},{"path":"assets/brandIcons-CY2R3D-W.js","integrity":"sha256-bQfVeUCnDE6SfHrA0KGkBE1VV5p5dV3nILk2rXPyZIY="},{"path":"assets/drive-Vt5M8iIT.js","integrity":"sha256-GpcXpSmuLfgDC+mUrMSFL6M0SByR11z0YT6+3dzC0P0="},{"path":"assets/driveHandoff-CI9NkUoP.js","integrity":"sha256-qxIkN1Vhe/NdGE1+8KdRlcGXncVisVMcNIfSbOw3RrU="},{"path":"assets/kdf.worker-sVQUwJ7p.js","integrity":"sha256-vKZ4I+CHfJ/YpwCFHZWF57ScWVlH48OYNQhMjFOfvl8="},{"path":"assets/strength.worker-B9YFkIJ4.js","integrity":"sha256-we950/ZsiSQKT2IvD0Mu+MN83EoWAxnpXEUBMISZVHA="},{"path":"assets/styles-Bk6yuYIV.js","integrity":"sha256-USZPpIdG41YdOCpSCR9wL/wwvZt/+rrKek8yrgUSeEo="},{"path":"assets/styles-CIdJ_eeI.css","integrity":"sha256-e0B9Et4VoRkioKwceAed76wO+zLATUm18w7kF13zJvg="},{"path":"auth.html","integrity":"sha256-gtV2clSp1wozj6qJ53KnJhTJ7wNwqVQ/YO4GvZH1oQ4="},{"path":"drive.html","integrity":"sha256-fyiJhNt91DcNkYuFtCFMhz9QZpD/IGqiraC5UoFRkRU="},{"path":"favicon.svg","integrity":"sha256-K2xDO20L0B1KzQIWmpQLASZtyFrjGFm+57wIe3aEJIo="},{"path":"icons/apple-touch-icon.png","integrity":"sha256-8XIYBuuSNyRCfsa+ONBHVCvbqvVF6wRyKFwkcXx9LTc="},{"path":"icons/icon-192.png","integrity":"sha256-E4U8Nw8qKegiItpNM7ab/GNPgYUVzXcvl6t6a331JPg="},{"path":"icons/icon-512.png","integrity":"sha256-sSamrGcY2Drrvy3lvdDEc2h8xwEJCwz3O8OckLEn8g8="},{"path":"icons/launch-1290x2796.png","integrity":"sha256-P47Lf4B+w66/lIxBybtXQHkJ9SrMw6qH/o5V5jkAjNE="},{"path":"icons/maskable-512.png","integrity":"sha256-sSamrGcY2Drrvy3lvdDEc2h8xwEJCwz3O8OckLEn8g8="},{"path":"index.html","integrity":"sha256-KYTJxf1jJ/+AzL8NbAukueGEQEcAN6oiOxZsb6X+9FU="},{"path":"manifest.webmanifest","integrity":"sha256-d7j+7VL2FzZSvwvkDYndy3/AekG/BqmIdC2FMnUfeGI="}];
const VERSION = "N2KfWHMfVpVObYXBbCiO";
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
