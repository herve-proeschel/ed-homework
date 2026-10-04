import { useHomeworkPrinter } from '../hooks/useHomeworkPrinter';
import { AppContext } from './appContext';

export function AppProvider({ children }) {
  const appState = useHomeworkPrinter();
  const { eleveModal, printDays, scheduleEvents, grades, downloadedDataByEleve } = appState;
  const selectedEleveId = eleveModal?.selectedId ?? null;
  const selectedEleve = eleveModal?.eleves.find(
    (eleve) => String(eleve.id) === String(selectedEleveId),
  ) || null;
  const currentDownloadedData = {
    homework: printDays,
    schedule: scheduleEvents,
    grades,
  };
  const downloadedData = selectedEleveId == null
    ? currentDownloadedData
    : downloadedDataByEleve[String(selectedEleveId)] || currentDownloadedData;

  const value = {
    ...appState,
    selectedEleve,
    selectedEleveId,
    downloadedData,
    downloadedDataByEleve,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
