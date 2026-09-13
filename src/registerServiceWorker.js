export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;
  let isReloading = false;

  const requestActivation = (registration) => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const requestUpdate = (registration) => {
    registration.update().catch(() => {
      // Ignorer les échecs de vérification (hors-ligne ou réseau instable)
    });
  };

  const monitorInstallingWorker = (registration) => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      if (
        installingWorker.state === 'installed' &&
        navigator.serviceWorker.controller
      ) {
        requestActivation(registration);
      }
    });
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading) return;
    isReloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(serviceWorkerUrl, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      })
      .then((registration) => {
        if (registration.waiting) {
          requestActivation(registration);
        }

        monitorInstallingWorker(registration);
        registration.addEventListener('updatefound', () => {
          monitorInstallingWorker(registration);
        });

        requestUpdate(registration);

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            requestUpdate(registration);
          }
        });

        window.addEventListener('focus', () => {
          requestUpdate(registration);
        });

        window.addEventListener('online', () => {
          requestUpdate(registration);
        });

        // Vérification périodique toutes les 60 minutes
        setInterval(() => {
          requestUpdate(registration);
        }, 60 * 60 * 1000);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
