// Build inserts the immutable static-file list and version. Never cache vaults,
// exports, OAuth responses or arbitrary network requests here.
const FILES = [{"path":"assets/app-CXSJsh_s.css","integrity":"sha256-eCmulH69Fb8pJ7tiI9tDj1LwlO6GX9G0VEQNKyP9qJM="},{"path":"assets/app-DCPq0L8f.js","integrity":"sha256-yqoDndW7RmtBjv14vB7jm7jHu3GeFj4TCZeBR31tBvE="},{"path":"assets/audit.worker-A9UJ8lNM.js","integrity":"sha256-DQS2W4fKOIvtjwDQ10iMf3dATYKwLd53po51Lkzz7MM="},{"path":"assets/auth-ANJQxEFa.js","integrity":"sha256-nTKZV4MrfH8+7jqtFX16sbOQBZMd2KjGmC/BLsZnmXs="},{"path":"assets/autoPreference-CKDOuT5c.js","integrity":"sha256-BeQndHdHh4bNmYf/FaMnjet0qh27UpVhF++2h67szjU="},{"path":"assets/brandIcons-CY2R3D-W.js","integrity":"sha256-bQfVeUCnDE6SfHrA0KGkBE1VV5p5dV3nILk2rXPyZIY="},{"path":"assets/drive-DFo92WTY.js","integrity":"sha256-VA4Py9qHoK19/YrvXEmbmbTF6AB3T/K+q8y/kLgKCL8="},{"path":"assets/driveHandoff-5GhleCr_.js","integrity":"sha256-2idJ4PJPeHkWUrfGxGO93bpTSAteLpvfldJypySUEoo="},{"path":"assets/kdf.worker-sVQUwJ7p.js","integrity":"sha256-vKZ4I+CHfJ/YpwCFHZWF57ScWVlH48OYNQhMjFOfvl8="},{"path":"assets/strength.worker-B9YFkIJ4.js","integrity":"sha256-we950/ZsiSQKT2IvD0Mu+MN83EoWAxnpXEUBMISZVHA="},{"path":"assets/styles-Bk6yuYIV.js","integrity":"sha256-USZPpIdG41YdOCpSCR9wL/wwvZt/+rrKek8yrgUSeEo="},{"path":"assets/styles-CIdJ_eeI.css","integrity":"sha256-e0B9Et4VoRkioKwceAed76wO+zLATUm18w7kF13zJvg="},{"path":"auth.html","integrity":"sha256-gtV2clSp1wozj6qJ53KnJhTJ7wNwqVQ/YO4GvZH1oQ4="},{"path":"drive.html","integrity":"sha256-CCBqbKACzKkINisGRiSnwI7RrUY8lBvhIuq4YrCgqH0="},{"path":"favicon.svg","integrity":"sha256-Ld4jAzjiPAOzzsyfXB8BWoBj70a27kMX7QdpY8MejvY="},{"path":"icons/apple-touch-icon.png","integrity":"sha256-OscW5Lc3dMSivh1AjLgk48CB2lG2p+8f+b2VEz6V5H4="},{"path":"icons/icon-192.png","integrity":"sha256-r2kr5Ye+t9eQXkxNW/whiYIfnonVSbeDrSSTvc2DYxc="},{"path":"icons/icon-512.png","integrity":"sha256-XufWaZQeHZBbMpDfdkvmGRXcaZ2SRsgAuE67Q1P8Nnk="},{"path":"icons/launch-1290x2796.png","integrity":"sha256-tajErm8v/NPdabFQIOo/cZS+WCkT1jnDL4+gKCmlqS4="},{"path":"icons/maskable-512.png","integrity":"sha256-3T7y6zeM8qls/QOmtEde/cOQjc/+3LQeGHyYNvWeBoU="},{"path":"index.html","integrity":"sha256-t0SqSOVUkXQW9S+NL6C9wgt/KnQ+yBgXCEerNp7euLM="},{"path":"manifest.webmanifest","integrity":"sha256-d7j+7VL2FzZSvwvkDYndy3/AekG/BqmIdC2FMnUfeGI="}];
const VERSION = "8RjQoi5bugqjyEFPyZS0";
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
