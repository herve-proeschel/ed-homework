import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccountFullName, isSessionExpiredError } from '../services/edClient';
import { saveUsername } from '../services/sessionStorage';
import { useStatusMessage } from './useStatusMessage';
import { usePrintHomework } from './usePrintHomework';
import { useEleveSelection } from './useEleveSelection';
import { useAuthSession } from './useAuthSession';
import { getHomeworkDocumentFilename } from '../utils/homeworkDocuments';

const VIEW_STATUS_MESSAGES = {
  homework: 'Téléchargez les devoirs.',
  schedule: 'Téléchargez l’emploi du temps.',
  grades: 'Téléchargez les notes.',
};

const VIEW_MODE_STORAGE_KEY = 'ed-homework:viewMode';

function getSavedViewMode() {
  try {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return saved in VIEW_STATUS_MESSAGES ? saved : 'homework';
  } catch {
    return 'homework';
  }
}

function createDownloadedData() {
  return {
    homework: null,
    schedule: [],
    grades: null,
    scheduleWeekCount: 0,
    scheduleHasMore: true,
  };
}

export function useHomeworkPrinter() {
  const runRef = useRef(null);
  const [downloadedDataByEleve, setDownloadedDataByEleve] = useState({});
  const downloadedDataByEleveRef = useRef(downloadedDataByEleve);
  const autoDownloadKeyRef = useRef('');
  const [viewMode, setViewMode] = useState(getSavedViewMode);
  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleWeekCount, setScheduleWeekCount] = useState(0);
  const [scheduleHasMore, setScheduleHasMore] = useState(true);
  const [grades, setGrades] = useState(null);
  const [gradesBusy, setGradesBusy] = useState(false);

  const { status, statusIsError, logStatus } = useStatusMessage();

  const { printDays, setPrintDays, buildPrintHtml, printHomework, afterPrint } = usePrintHomework({ logStatus });

  const { eleveModal, setEleveModal, eleveListRef, selectedEleveIdRef, selectEleveOption, confirmEleve, chooseEleve } =
    useEleveSelection({ runRef });

  const getDownloadedData = useCallback((eleveId) => {
    return downloadedDataByEleveRef.current[String(eleveId)] || null;
  }, []);

  const updateDownloadedData = useCallback((eleveId, update) => {
    const key = String(eleveId);
    const previous = downloadedDataByEleveRef.current[key] || createDownloadedData();
    const nextEntry = update(previous);
    const nextDictionary = { ...downloadedDataByEleveRef.current, [key]: nextEntry };
    downloadedDataByEleveRef.current = nextDictionary;
    setDownloadedDataByEleve(nextDictionary);
    return nextEntry;
  }, []);

  const selectEleve = useCallback(
    (id) => {
      const selectedId = String(id);
      selectedEleveIdRef.current = selectedId;
      selectEleveOption(id);
      autoDownloadKeyRef.current = '';
      const cachedData = getDownloadedData(selectedId);
      const cachedDays = cachedData?.homework ?? null;
      const cachedSchedule = cachedData?.schedule ?? [];
      setPrintDays(cachedDays);
      setScheduleEvents(cachedSchedule);
      setScheduleWeekCount(cachedData?.scheduleWeekCount ?? (cachedSchedule.length ? 1 : 0));
      setScheduleHasMore(cachedData?.scheduleHasMore ?? true);
      setGrades(cachedData?.grades ?? null);
      logStatus(cachedDays?.length ? 'Devoirs récupérés, prêts à imprimer.' : '');
    },
    [getDownloadedData, selectEleveOption, setPrintDays, setScheduleEvents, logStatus, selectedEleveIdRef],
  );

  const resetDownloadedData = useCallback((events) => {
    setScheduleEvents(events);
    setScheduleWeekCount(0);
    setScheduleHasMore(true);
    setGrades(null);
    const emptyDictionary = {};
    downloadedDataByEleveRef.current = emptyDictionary;
    setDownloadedDataByEleve(emptyDictionary);
  }, [setScheduleEvents]);

  const {
    clientRef,
    username,
    setUsername,
    password,
    setPassword,
    isLoggedIn,
    setIsLoggedIn,
    busy,
    setBusy,
    displayName,
    setDisplayName,
    qcm,
    answerQcm,
    performLogin,
    restoreFromStorage,
    persistSession,
    handleSessionExpired,
    disconnect,
  } = useAuthSession({ logStatus, eleveListRef, selectedEleveIdRef, setEleveModal, setPrintDays, setScheduleEvents: resetDownloadedData });

  const openDocument = useCallback(async (document) => {
    try {
      const blob = await clientRef.current.downloadDocument(document.id ?? document.fichierId, document.type);
      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = window.document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = getHomeworkDocumentFilename(document);
      downloadLink.style.display = 'none';
      window.document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      if (isSessionExpiredError({ message: error.message })) {
        handleSessionExpired();
      } else {
        logStatus(`Impossible d'ouvrir le document : ${error.message}`, true);
      }
    }
  }, [clientRef, handleSessionExpired, logStatus]);

  const dateKey = (date) => date.toISOString().split('T')[0];
  const startOfWeek = (date) => {
    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const loadScheduleWeek = useCallback(async (eleveId, weekOffset) => {
    const weekStart = startOfWeek(new Date());
    weekStart.setDate(weekStart.getDate() + weekOffset * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const response = await clientRef.current.getSchedule(eleveId, dateKey(weekStart), dateKey(weekEnd));
    if (!response || response.code !== 200) {
      throw new Error(response?.message || 'Erreur lors de la lecture de l’emploi du temps.');
    }
    if (!Array.isArray(response.data)) {
      throw new Error('Le format de l’emploi du temps reçu est invalide.');
    }
    return response.data;
  }, [clientRef]);

  const retrieveSchedule = useCallback(async () => {
    const eleveId = selectedEleveIdRef.current;
    if (!eleveId || scheduleBusy) return;
    const weekOffset = scheduleWeekCount;
    setScheduleBusy(true);
    logStatus(weekOffset ? 'Téléchargement de la semaine suivante...' : 'Téléchargement de l’emploi du temps...');
    try {
      const events = await loadScheduleWeek(eleveId, weekOffset);
      if (events.length === 0) {
        updateDownloadedData(eleveId, (previous) => ({ ...previous, scheduleHasMore: false }));
        setScheduleHasMore(false);
        logStatus('Aucune semaine supplémentaire trouvée.');
        return;
      }
      const cachedSchedule = getDownloadedData(eleveId)?.schedule || [];
      const merged = new Map(cachedSchedule.map((event) => [
        `${event.id || ''}-${event.start_date || ''}-${event.end_date || ''}`,
        event,
      ]));
      events.forEach((event) => merged.set(`${event.id || ''}-${event.start_date || ''}-${event.end_date || ''}`, event));
      const nextEvents = [...merged.values()];
      updateDownloadedData(eleveId, (previous) => ({
        ...previous,
        schedule: nextEvents,
        scheduleWeekCount: weekOffset + 1,
        scheduleHasMore: true,
      }));
      if (String(selectedEleveIdRef.current) === String(eleveId)) {
        setScheduleEvents(nextEvents);
        setScheduleWeekCount(weekOffset + 1);
        setScheduleHasMore(true);
      }
      logStatus(weekOffset ? 'Semaine suivante téléchargée.' : 'Emploi du temps téléchargé.');
    } catch (error) {
      if (isSessionExpiredError({ message: error.message })) handleSessionExpired();
      else logStatus(`Erreur : ${error.message}`, true);
    } finally {
      setScheduleBusy(false);
    }
  }, [getDownloadedData, handleSessionExpired, loadScheduleWeek, logStatus, scheduleBusy, scheduleWeekCount, selectedEleveIdRef, updateDownloadedData]);

  const retrieveGrades = useCallback(async () => {
    const eleveId = selectedEleveIdRef.current;
    if (!eleveId || gradesBusy) return;
    setGradesBusy(true);
    logStatus('Téléchargement des notes...');
    try {
      const response = await clientRef.current.getNotes(eleveId);
      if (isSessionExpiredError(response)) {
        handleSessionExpired();
        return;
      }
      if (!response || response.code !== 200 || !response.data) {
        throw new Error(response?.message || 'Erreur lors de la lecture des notes.');
      }
      const data = {
        periodes: Array.isArray(response.data.periodes) ? response.data.periodes : [],
        notes: Array.isArray(response.data.notes) ? response.data.notes : [],
      };
      updateDownloadedData(eleveId, (previous) => ({ ...previous, grades: data }));
      if (String(selectedEleveIdRef.current) === String(eleveId)) {
        setGrades(data);
      }
      logStatus('Notes téléchargées.');
    } catch (error) {
      if (isSessionExpiredError({ message: error.message })) handleSessionExpired();
      else logStatus(`Erreur : ${error.message}`, true);
    } finally {
      setGradesBusy(false);
    }
  }, [clientRef, gradesBusy, handleSessionExpired, logStatus, selectedEleveIdRef, updateDownloadedData]);

  const selectView = useCallback((mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // stockage indisponible : on ignore
    }
    logStatus(VIEW_STATUS_MESSAGES[mode]);
  }, [logStatus]);

  const switchView = useCallback((direction = 1) => {
    const viewModes = ['homework', 'schedule', 'grades'];
    const currentIndex = viewModes.indexOf(viewMode);
    const nextIndex = (currentIndex + direction + viewModes.length) % viewModes.length;
    selectView(viewModes[nextIndex]);
  }, [selectView, viewMode]);

  const run = useCallback(async () => {
    if (!username || (!isLoggedIn && !password)) {
      logStatus('Veuillez renseigner votre identifiant et mot de passe.', true);
      return;
    }

    saveUsername(username);
    setBusy(true);
    setPrintDays(null);

    try {
      let eleveId = selectedEleveIdRef.current;

      if (!isLoggedIn) {
        const accountData = await performLogin();
        const accountDisplayName = getAccountFullName(accountData);
        setDisplayName(accountDisplayName);
        setIsLoggedIn(true);
        logStatus("Téléchargez les devoirs.");
        eleveId = await chooseEleve(accountData);

        if (!eleveId) throw new Error('Profil élève introuvable sur ce compte.');

        selectedEleveIdRef.current = eleveId;
        persistSession(accountDisplayName);
      }

      if (viewMode === 'schedule' || viewMode === 'grades') {
        setBusy(false);
        await (viewMode === 'schedule' ? retrieveSchedule() : retrieveGrades());
        return;
      }

      logStatus('Lecture du planning du cahier de texte...');
      let listRes = await clientRef.current.getCahierDeTexte(eleveId);

      // Si la session/token a expiré
      if (isSessionExpiredError(listRes)) {
        if (password) {
          logStatus('Session expirée, ré-authentification en cours...');
          const accountData = await performLogin();
          const accountDisplayName = getAccountFullName(accountData);
          setDisplayName(accountDisplayName);
          setIsLoggedIn(true);
          persistSession(accountDisplayName);
          listRes = await clientRef.current.getCahierDeTexte(eleveId);
        } else {
          handleSessionExpired();
          setBusy(false);
          return;
        }
      }

      if (listRes.code !== 200 || !listRes.data) {
        if (isSessionExpiredError(listRes)) {
          handleSessionExpired();
          setBusy(false);
          return;
        }
        throw new Error(listRes.message || 'Erreur lors de la lecture du cahier de texte.');
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const futureDates = Object.keys(listRes.data).filter((d) => d > todayStr).sort();

      if (futureDates.length === 0) {
        updateDownloadedData(eleveId, (previous) => ({ ...previous, homework: [] }));
        logStatus('Aucun devoir programmé pour les jours suivants.');
        persistSession();
        if (String(selectedEleveIdRef.current) === String(eleveId)) {
          setPrintDays([]);
        }
        setBusy(false);
        return;
      }

      const isCurrentEleve = () => String(selectedEleveIdRef.current) === String(eleveId);
      const progressiveDays = futureDates.map((date) => ({ date, matieres: [], loading: true }));
      if (isCurrentEleve()) setPrintDays(progressiveDays);

      const detailedDays = [];
      for (let i = 0; i < futureDates.length; i++) {
        const date = futureDates[i];
        logStatus(`Collecte (${i + 1}/${futureDates.length}) : ${date}...`);
        let detail = await clientRef.current.getCahierDeTexteDetail(eleveId, date);

        if (isSessionExpiredError(detail)) {
          if (password) {
            logStatus('Renouvellement de la session...');
            const accountData = await performLogin();
            const accountDisplayName = getAccountFullName(accountData);
            setDisplayName(accountDisplayName);
            setIsLoggedIn(true);
            persistSession(accountDisplayName);
            detail = await clientRef.current.getCahierDeTexteDetail(eleveId, date);
          } else {
            handleSessionExpired('Votre session a expiré pendant la récupération. Veuillez vous reconnecter.');
            setBusy(false);
            return;
          }
        }

        if (detail && detail.code === 200 && detail.data) {
          detailedDays.push(detail.data);
          progressiveDays[i] = detail.data;
        } else {
          progressiveDays[i] = null;
        }
        if (isCurrentEleve()) setPrintDays(progressiveDays.filter((day) => day !== null));
      }

      persistSession();
      logStatus('Devoirs récupérés, prêts à imprimer.');
      updateDownloadedData(eleveId, (previous) => ({ ...previous, homework: detailedDays }));
      if (String(selectedEleveIdRef.current) === String(eleveId)) {
        setPrintDays(detailedDays);
      }
      setBusy(false);
    } catch (err) {
      console.error(err);
      if (isSessionExpiredError({ message: err.message })) {
        handleSessionExpired();
      } else {
        logStatus('Erreur : ' + err.message, true);
      }
      setBusy(false);
    }
  }, [
    username,
    password,
    isLoggedIn,
    performLogin,
    chooseEleve,
    persistSession,
    logStatus,
    handleSessionExpired,
    clientRef,
    selectedEleveIdRef,
    setBusy,
    setPrintDays,
    setDisplayName,
    setIsLoggedIn,
    updateDownloadedData,
    viewMode,
    retrieveSchedule,
    retrieveGrades,
  ]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    const selectedEleveId = selectedEleveIdRef.current;
    if (!isLoggedIn || !selectedEleveId || busy || scheduleBusy || gradesBusy) return undefined;
    const autoDownloadKey = `${selectedEleveId}:${viewMode}`;
    const cachedData = getDownloadedData(selectedEleveId);
    if (autoDownloadKeyRef.current === autoDownloadKey) return undefined;
    if (viewMode === 'schedule' && scheduleEvents.length) return undefined;
    if (viewMode === 'schedule' && cachedData?.scheduleHasMore === false) return undefined;
    if (viewMode === 'grades' && grades) return undefined;
    if (viewMode === 'homework' && printDays) return undefined;

    autoDownloadKeyRef.current = autoDownloadKey;
    const timer = window.setTimeout(() => {
      if (viewMode === 'schedule') retrieveSchedule();
      else if (viewMode === 'grades') retrieveGrades();
      else run();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [busy, downloadedDataByEleve, getDownloadedData, grades, gradesBusy, isLoggedIn, eleveModal?.selectedId, printDays, retrieveGrades, retrieveSchedule, run, scheduleBusy, scheduleEvents.length, selectedEleveIdRef, viewMode]);

  return {
    username,
    setUsername,
    displayName,
    password,
    setPassword,
    isLoggedIn,
    busy,
    status,
    statusIsError,
    qcm,
    answerQcm,
    eleveModal,
    selectEleve,
    confirmEleve,
    printDays,
    downloadedDataByEleve,
    scheduleEvents,
    scheduleBusy,
    hasMoreSchedule: scheduleHasMore,
    grades,
    gradesBusy,
    viewMode,
    switchView,
    selectView,
    retrieveSchedule,
    retrieveGrades,
    openDocument,
    buildPrintHtml,
    run,
    printHomework,
    afterPrint,
    disconnect,
    restoreFromStorage,
  };
}
