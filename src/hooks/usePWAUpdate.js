import { useEffect, useState } from 'react';
import {
  activateServiceWorkerUpdate,
  subscribeToServiceWorkerUpdates,
} from '../registerServiceWorker';

export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => subscribeToServiceWorkerUpdates(setUpdateAvailable), []);

  return {
    updateAvailable,
    applyUpdate: activateServiceWorkerUpdate,
  };
}
