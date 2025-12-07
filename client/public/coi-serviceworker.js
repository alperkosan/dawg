/*! coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT */
let coepCredentialless = false;
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (ev) => {
        if (!ev.data) {
            return;
        } else if (ev.data.type === "deregister") {
            self.registration.unregister().then(() => {
                return self.clients.matchAll();
            }).then(clients => {
                clients.forEach(client => client.navigate(client.url));
            });
        }
    });

    self.addEventListener("fetch", function (event) {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
                    if (!coepCredentialless) {
                        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                    }

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => console.error(e))
        );
    });

} else {
    (() => {
        const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
        window.sessionStorage.removeItem("coiReloadedBySelf");
        const coepDegrading = (reloadedBySelf == "coepdegrade");

        if ((window.crossOriginIsolated || navigator.serviceWorker.controller) && !coepDegrading) return;

        const registration = navigator.serviceWorker.register(window.document.currentScript.src).then(
            (registration) => {
                console.log("COI Service Worker registered", registration.scope);

                registration.addEventListener("updatefound", () => {
                    console.log("Reloading page to make use of updated COI Service Worker.");
                    window.location.reload();
                });

                if (registration.active && !navigator.serviceWorker.controller) {
                    console.log("Reloading page to make use of COI Service Worker.");
                    window.location.reload();
                }
            },
            (err) => {
                console.error("COI Service Worker failed to register:", err);
            }
        );
    })();
}
