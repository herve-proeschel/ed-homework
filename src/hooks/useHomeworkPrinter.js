import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccountFullName, isSessionExpiredError } from '../services/edClient';
import { saveUsername } from '../services/sessionStorage';
import { useStatusMessage } from './useStatusMessage';
import { usePrintHomework } from './usePrintHomework';
import { useEleveSelection } from './useEleveSelection';
import { useAuthSession } from './useAuthSession';

const VIEW_STATUS_MESSAGES = {
  homework: 'Téléchargez les devoirs.',
  schedule: 'Téléchargez l’emploi du temps.',
  grades: 'Téléchargez les notes.',
};

export function useHomeworkPrinter() {
  const runRef = useRef(null);
  const downloadedDaysByEleveRef = useRef({});
  const scheduleEventsByEleveRef = useRef({});
  const autoDownloadKeyRef = useRef('');
  const [viewMode, setViewMode] = useState('homework');
  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleWeekCount, setScheduleWeekCount] = useState(0);
  const [scheduleHasMore, setScheduleHasMore] = useState(true);
  const gradesByEleveRef = useRef({});
  const [grades, setGrades] = useState(null);
  const [gradesBusy, setGradesBusy] = useState(false);

  const { status, statusIsError, logStatus } = useStatusMessage();

  const { printDays, setPrintDays, buildPrintHtml, printHomework, afterPrint } = usePrintHomework({ logStatus });

  const { eleveModal, setEleveModal, eleveListRef, selectedEleveIdRef, selectEleveOption, reopenEleve, confirmEleve, chooseEleve } =
    useEleveSelection({ runRef });

  const selectEleve = useCallback(
    (id) => {
      selectEleveOption(id);
      const cachedDays = downloadedDaysByEleveRef.current[id] || null;
      const cachedSchedule = scheduleEventsByEleveRef.current[id] || [];
      setPrintDays(cachedDays);
      setScheduleEvents(cachedSchedule);
      setScheduleWeekCount(cachedSchedule.length ? 1 : 0);
      setScheduleHasMore(true);
      setGrades(gradesByEleveRef.current[id] || null);
      logStatus(cachedDays?.length ? 'Devoirs récupérés, prêts à imprimer.' : '');
    },
    [selectEleveOption, setPrintDays, setScheduleEvents, logStatus],
  );

  const resetScheduleAndGrades = useCallback((events) => {
    setScheduleEvents(events);
    setGrades(null);
    gradesByEleveRef.current = {};
  }, []);

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
  } = useAuthSession({ logStatus, eleveListRef, selectedEleveIdRef, setEleveModal, setPrintDays, setScheduleEvents: resetScheduleAndGrades });

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
    setScheduleBusy(true);
    logStatus(scheduleWeekCount ? 'Téléchargement de la semaine suivante...' : 'Téléchargement de l’emploi du temps...');
    try {
      const events = await loadScheduleWeek(eleveId, scheduleWeekCount);
      if (events.length === 0) {
        setScheduleHasMore(false);
        logStatus('Aucune semaine supplémentaire trouvée.');
        return;
      }
      const merged = new Map((scheduleEventsByEleveRef.current[eleveId] || []).map((event) => [
        `${event.id || ''}-${event.start_date || ''}-${event.end_date || ''}`,
        event,
      ]));
      events.forEach((event) => merged.set(`${event.id || ''}-${event.start_date || ''}-${event.end_date || ''}`, event));
      const nextEvents = [...merged.values()];
      scheduleEventsByEleveRef.current[eleveId] = nextEvents;
      setScheduleEvents(nextEvents);
      setScheduleWeekCount((count) => count + 1);
      logStatus(scheduleWeekCount ? 'Semaine suivante téléchargée.' : 'Emploi du temps téléchargé.');
    } catch (error) {
      if (isSessionExpiredError({ message: error.message })) handleSessionExpired();
      else logStatus(`Erreur : ${error.message}`, true);
    } finally {
      setScheduleBusy(false);
    }
  }, [handleSessionExpired, loadScheduleWeek, logStatus, scheduleBusy, scheduleWeekCount, selectedEleveIdRef]);

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
      gradesByEleveRef.current[eleveId] = data;
      setGrades(data);
      logStatus('Notes téléchargées.');
    } catch (error) {
      if (isSessionExpiredError({ message: error.message })) handleSessionExpired();
      else logStatus(`Erreur : ${error.message}`, true);
    } finally {
      setGradesBusy(false);
    }
  }, [clientRef, gradesBusy, handleSessionExpired, logStatus, selectedEleveIdRef]);

  const selectView = useCallback((mode) => {
    setViewMode(mode);
    logStatus(VIEW_STATUS_MESSAGES[mode]);
  }, [logStatus]);

  const switchView = useCallback(() => {
    const nextMode = { homework: 'schedule', schedule: 'grades', grades: 'homework' }[viewMode];
    selectView(nextMode);
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
        logStatus('Aucun devoir programmé pour les jours suivants.');
        persistSession();
        setBusy(false);
        return;
      }

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
        }
      }

      persistSession();
      logStatus('Devoirs récupérés, prêts à imprimer.');
      downloadedDaysByEleveRef.current[eleveId] = detailedDays;
      setPrintDays(detailedDays);
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
    if (autoDownloadKeyRef.current === autoDownloadKey) return undefined;
    if (viewMode === 'schedule' && scheduleEvents.length) return undefined;
    if (viewMode === 'grades' && grades) return undefined;
    if (viewMode === 'homework' && printDays) return undefined;

    autoDownloadKeyRef.current = autoDownloadKey;
    const timer = window.setTimeout(() => {
      if (viewMode === 'schedule') retrieveSchedule();
      else if (viewMode === 'grades') retrieveGrades();
      else run();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [busy, grades, gradesBusy, isLoggedIn, printDays, retrieveGrades, retrieveSchedule, run, scheduleBusy, scheduleEvents.length, selectedEleveIdRef, viewMode]);

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
    reopenEleve,
    confirmEleve,
    printDays,
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
    buildPrintHtml,
    run,
    printHomework,
    afterPrint,
    disconnect,
    restoreFromStorage,
  };
}
