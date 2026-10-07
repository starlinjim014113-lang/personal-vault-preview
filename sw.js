// Build inserts the immutable static-file list and version. Never cache vaults,
// exports, OAuth responses or arbitrary network requests here.
const FILES = [{"path":"assets/app-DKdqchQs.css","integrity":"sha256-m9IrHaBdDhSSiVhLgOWMHQ7HVCTApKoVuD4MXT1kK8M="},{"path":"assets/app-DkX8CpOZ.js","integrity":"sha256-vnwylH+HttwRfaiGUVQgoEGZY3RMYhHmrQ0+4YWhMic="},{"path":"assets/audit.worker-A9UJ8lNM.js","integrity":"sha256-DQS2W4fKOIvtjwDQ10iMf3dATYKwLd53po51Lkzz7MM="},{"path":"assets/auth-CBki5DjJ.js","integrity":"sha256-k3IoHBi3Y8+CbnUjV3x0wURQYBsaaX16cK3eIQMW/aE="},{"path":"assets/autoPreference-CKDOuT5c.js","integrity":"sha256-BeQndHdHh4bNmYf/FaMnjet0qh27UpVhF++2h67szjU="},{"path":"assets/brandIcons-CY2R3D-W.js","integrity":"sha256-bQfVeUCnDE6SfHrA0KGkBE1VV5p5dV3nILk2rXPyZIY="},{"path":"assets/drive-Cy6GbJ92.js","integrity":"sha256-rGkkX66nMtlurCfZ6AsgBElYkIzojxGhdjBiAUcMqo4="},{"path":"assets/driveHandoff-D0ZXGAAS.js","integrity":"sha256-kB44boEvdigld1zJ0c1Tyrho8rRd5YW0jHh5+o3F8m8="},{"path":"assets/kdf.worker-sVQUwJ7p.js","integrity":"sha256-vKZ4I+CHfJ/YpwCFHZWF57ScWVlH48OYNQhMjFOfvl8="},{"path":"assets/strength.worker-B9YFkIJ4.js","integrity":"sha256-we950/ZsiSQKT2IvD0Mu+MN83EoWAxnpXEUBMISZVHA="},{"path":"assets/styles-D-m4NwRd.js","integrity":"sha256-NbZHBq9Xi3g2+veY/VgXtZk9e+DX8CL2PpcH/Jkmdvk="},{"path":"assets/styles-DBQSx_XS.css","integrity":"sha256-wsxDYnFMjviVSzKsh/jvSYYTcNmpKfLja3kh5/Tfu0E="},{"path":"auth.html","integrity":"sha256-5FAVaoKb9GNn6vqSurPgpC1FVosphivlYbi/MumqhCQ="},{"path":"drive.html","integrity":"sha256-gnOvJaDR1OLTRusTHkjuizbOul5OcJvsDqp6ifhSFog="},{"path":"favicon.svg","integrity":"sha256-Ld4jAzjiPAOzzsyfXB8BWoBj70a27kMX7QdpY8MejvY="},{"path":"icons/apple-touch-icon.png","integrity":"sha256-OscW5Lc3dMSivh1AjLgk48CB2lG2p+8f+b2VEz6V5H4="},{"path":"icons/icon-192.png","integrity":"sha256-r2kr5Ye+t9eQXkxNW/whiYIfnonVSbeDrSSTvc2DYxc="},{"path":"icons/icon-512.png","integrity":"sha256-XufWaZQeHZBbMpDfdkvmGRXcaZ2SRsgAuE67Q1P8Nnk="},{"path":"icons/launch-1290x2796.png","integrity":"sha256-tajErm8v/NPdabFQIOo/cZS+WCkT1jnDL4+gKCmlqS4="},{"path":"icons/maskable-512.png","integrity":"sha256-3T7y6zeM8qls/QOmtEde/cOQjc/+3LQeGHyYNvWeBoU="},{"path":"index.html","integrity":"sha256-LA8XEr+Ds//7uvL3WgxmQ3jPsUY2kJLZWelB889gfk0="},{"path":"manifest.webmanifest","integrity":"sha256-d7j+7VL2FzZSvwvkDYndy3/AekG/BqmIdC2FMnUfeGI="}];
const VERSION = "FjDWDqGyCcFoccqxtjBi";
const scope = new URL(self.registration.scope);
const prefix = `vault-shell:${scope.pathname}:`;
const cacheName = prefix + VERSION;
const urls = new Map(
  FILES.map((file) => [new URL(file.path, scope).href, file]),
);
const shell = new URL("index.html", scope).href;

// Cache Storage is writable by any script on this origin. Serve a cached file
// only if its bytes still match this build's integrity hash.
async function matches(response, integrity) {
  const [algorithm, expected] = integrity.split(/-(.*)/s);
  if (algorithm !== "sha256" || !expected) return false;
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer()),
  );
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary) === expected;
}

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
      const file = urls.get(target);
      const cached = await cache.match(target);
      if (cached && (await matches(cached, file.integrity))) return cached;
      if (cached) await cache.delete(target);
      // An evicted or altered file can only be repaired with THIS build's bytes.
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
  // TEMPORARY (development): "Update now" on a locked screen activates a
  // downloaded update right away. Remove with PwaNotice's button when done.
  if (event.data?.type === "VAULT_SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
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
