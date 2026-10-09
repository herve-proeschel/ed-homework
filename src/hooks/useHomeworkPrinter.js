import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccountFullName, isSessionExpiredError } from '../services/edClient';
import { saveUsername } from '../services/sessionStorage';
import { useStatusMessage } from './useStatusMessage';
import { usePrintHomework } from './usePrintHomework';
import { useEleveSelection } from './useEleveSelection';
import { useAuthSession } from './useAuthSession';
import {
  getHomeworkDocumentFilename,
  getHomeworkDocumentSections,
  getHomeworkSession,
} from '../utils/homeworkDocuments';

const VIEW_STATUS_MESSAGES = {
  homework: 'Téléchargez les devoirs.',
  schedule: 'Téléchargez l’emploi du temps.',
  grades: 'Téléchargez les notes.',
  messages: 'Téléchargez les messages.',
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
    homeworkLoadedWeeks: [],
    schedule: [],
    grades: null,
    scheduleWeekCount: 0,
    scheduleHasMore: true,
  };
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDateKeys(weekStart) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return dateKey(date);
  });
}

function hasHomeworkContent(day) {
  const subjects = day?.matieres;
  if (!Array.isArray(subjects)) return Boolean(day);
  return subjects.some((subject) => {
    const session = getHomeworkSession(subject);
    const documents = getHomeworkDocumentSections(subject);
    return subject.aFaire
      || session?.contenu
      || documents.homework.length > 0
      || documents.session.length > 0;
  });
}

function mergeHomeworkDays(existingDays, newDays) {
  const daysByDate = new Map();
  [...existingDays, ...newDays].forEach((day) => {
    if (!day) return;
    daysByDate.set(day.date || `unknown-${daysByDate.size}`, day);
  });
  return [...daysByDate.values()].sort((left, right) => (
    String(left.date || '').localeCompare(String(right.date || ''))
  ));
}

function getPreviousWeekLabel(weekIndex) {
  if (weekIndex === 0) return 'la semaine précédente';
  if (weekIndex === 1) return 'la semaine encore précédente';
  return `la semaine d’il y a ${weekIndex + 1} semaines`;
}

export function useHomeworkPrinter() {
  const runRef = useRef(null);
  const [downloadedDataByEleve, setDownloadedDataByEleve] = useState({});
  const downloadedDataByEleveRef = useRef(downloadedDataByEleve);
  const autoDownloadKeyRef = useRef('');
  const previousHomeworkBusyRef = useRef(false);
  const [viewMode, setViewMode] = useState(getSavedViewMode);
  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleWeekCount, setScheduleWeekCount] = useState(0);
  const [scheduleHasMore, setScheduleHasMore] = useState(true);
  const [grades, setGrades] = useState(null);
  const [gradesBusy, setGradesBusy] = useState(false);
  const [messages, setMessages] = useState(null);
  const [messagesBusy, setMessagesBusy] = useState(false);
  const messagesSearchRef = useRef(0);
  const messagesQueryRef = useRef('');
  const [messagesQuery, setMessagesQuery] = useState('');

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

  const retrievePreviousHomework = useCallback(async () => {
    const eleveId = selectedEleveIdRef.current;
    if (!eleveId || busy || previousHomeworkBusyRef.current) return;

    const cachedData = getDownloadedData(eleveId);
    const loadedWeeks = Array.isArray(cachedData?.homeworkLoadedWeeks)
      ? cachedData.homeworkLoadedWeeks
      : [];
    const previousWeekIndex = new Set(loadedWeeks).size;
    const previousWeekStart = startOfWeek(new Date());
    previousWeekStart.setDate(previousWeekStart.getDate() - (previousWeekIndex + 1) * 7);
    const previousWeekKey = dateKey(previousWeekStart);
    const previousWeekLabel = getPreviousWeekLabel(previousWeekIndex);

    const isCurrentEleve = () => String(selectedEleveIdRef.current) === String(eleveId);
    const existingDays = cachedData?.homework
      || (isCurrentEleve() ? printDays || [] : []);
    previousHomeworkBusyRef.current = true;
    setBusy(true);
    logStatus(`Téléchargement de ${previousWeekLabel}...`);

    try {
      let listRes = await clientRef.current.getCahierDeTexte(eleveId);

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
          return;
        }
      }

      if (listRes.code !== 200 || !listRes.data || typeof listRes.data !== 'object') {
        throw new Error(listRes.message || 'Erreur lors de la lecture du cahier de texte.');
      }

      const weekEnd = new Date(previousWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekStartKey = dateKey(previousWeekStart);
      const weekEndKey = dateKey(weekEnd);
      const listedDates = Object.keys(listRes.data)
        .filter((date) => date >= weekStartKey && date <= weekEndKey)
        .sort();
      const previousWeekDates = listedDates.length ? listedDates : getWeekDateKeys(previousWeekStart);
      const detailedDays = [];

      for (let i = 0; i < previousWeekDates.length; i++) {
        const date = previousWeekDates[i];
        logStatus(`Collecte de ${previousWeekLabel} (${i + 1}/${previousWeekDates.length}) : ${date}...`);
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
            return;
          }
        }

        if (detail && detail.code !== 200) {
          throw new Error(detail.message || `Erreur lors de la lecture du devoir du ${date}.`);
        }
        if (detail?.data && hasHomeworkContent(detail.data)) {
          detailedDays.push(detail.data);
        }
      }

      const nextEntry = updateDownloadedData(eleveId, (previous) => {
        const previousLoadedWeeks = Array.isArray(previous.homeworkLoadedWeeks)
          ? previous.homeworkLoadedWeeks
          : [];
        return {
          ...previous,
          homework: mergeHomeworkDays(previous.homework || existingDays, detailedDays),
          homeworkLoadedWeeks: [...new Set([...previousLoadedWeeks, previousWeekKey])],
        };
      });

      if (isCurrentEleve()) {
        setPrintDays(nextEntry.homework);
      }
      persistSession();
      logStatus(
        detailedDays.length
          ? `Devoirs de ${previousWeekLabel} téléchargés.`
          : `Aucun devoir trouvé pour ${previousWeekLabel}.`,
      );
    } catch (error) {
      if (isSessionExpiredError({ message: error.message })) {
        handleSessionExpired();
      } else {
        if (isCurrentEleve()) setPrintDays(existingDays);
        logStatus(`Erreur : ${error.message}`, true);
      }
    } finally {
      previousHomeworkBusyRef.current = false;
      setBusy(false);
    }
  }, [
    busy,
    clientRef,
    getDownloadedData,
    handleSessionExpired,
    logStatus,
    password,
    performLogin,
    persistSession,
    printDays,
    selectedEleveIdRef,
    setBusy,
    setDisplayName,
    setIsLoggedIn,
    setPrintDays,
    updateDownloadedData,
  ]);

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

  const retrieveMessages = useCallback(async () => {
    const eleveId = selectedEleveIdRef.current;
    if (!eleveId || messagesBusy) return;
    setMessagesBusy(true);
    logStatus('Téléchargement des messages...');
    try {
      const response = await clientRef.current.getMessages(eleveId, messagesQueryRef.current);
      if (isSessionExpiredError(response)) {
        handleSessionExpired();
        return;
      }
      if (!response || response.code !== 200 || !response.data) {
        throw new Error(response?.message || 'Erreur lors de la lecture des messages.');
      }
      setMessages(Array.isArray(response.data.messages?.received) ? response.data.messages.received : []);
      logStatus('Messages téléchargés.');
    } catch (error) {
      if (isSessionExpiredError({ message: error.message })) handleSessionExpired();
      else logStatus(`Erreur : ${error.message}`, true);
    } finally {
      setMessagesBusy(false);
    }
  }, [clientRef, handleSessionExpired, logStatus, messagesBusy, selectedEleveIdRef]);

  const searchMessages = useCallback(async (searchQuery) => {
    const eleveId = selectedEleveIdRef.current;
    if (!eleveId) return;
    const requestId = ++messagesSearchRef.current;
    const trimmedQuery = searchQuery.trim();
    messagesQueryRef.current = trimmedQuery;
    setMessagesQuery(trimmedQuery);
    setMessagesBusy(true);
    try {
      const response = await clientRef.current.getMessages(eleveId, trimmedQuery);
      if (requestId !== messagesSearchRef.current) return;
      if (isSessionExpiredError(response)) {
        handleSessionExpired();
        return;
      }
      if (!response || response.code !== 200 || !response.data) {
        throw new Error(response?.message || 'Erreur lors de la recherche des messages.');
      }
      setMessages(Array.isArray(response.data.messages?.received) ? response.data.messages.received : []);
    } catch (error) {
      if (requestId !== messagesSearchRef.current) return;
      if (isSessionExpiredError({ message: error.message })) handleSessionExpired();
      else logStatus(`Erreur : ${error.message}`, true);
    } finally {
      if (requestId === messagesSearchRef.current) setMessagesBusy(false);
    }
  }, [clientRef, handleSessionExpired, logStatus, selectedEleveIdRef]);

  const loadMessage = useCallback(async (messageId) => {
    const eleveId = selectedEleveIdRef.current;
    const response = await clientRef.current.getMessage(eleveId, messageId);
    if (isSessionExpiredError(response)) {
      handleSessionExpired();
      return null;
    }
    if (!response || response.code !== 200 || !response.data) {
      throw new Error(response?.message || 'Erreur lors de la lecture du message.');
    }
    return response.data;
  }, [clientRef, handleSessionExpired, selectedEleveIdRef]);

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
    if (currentIndex === -1) return;
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

      if (viewMode === 'schedule' || viewMode === 'grades' || viewMode === 'messages') {
        setBusy(false);
        await (viewMode === 'schedule' ? retrieveSchedule() : viewMode === 'grades' ? retrieveGrades() : retrieveMessages());
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
    retrieveMessages,
  ]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    const selectedEleveId = selectedEleveIdRef.current;
    if (!isLoggedIn || !selectedEleveId || busy || scheduleBusy || gradesBusy || messagesBusy) return undefined;
    const autoDownloadKey = `${selectedEleveId}:${viewMode}`;
    const cachedData = getDownloadedData(selectedEleveId);
    if (autoDownloadKeyRef.current === autoDownloadKey) return undefined;
    if (viewMode === 'schedule' && scheduleEvents.length) return undefined;
    if (viewMode === 'schedule' && cachedData?.scheduleHasMore === false) return undefined;
    if (viewMode === 'grades' && grades) return undefined;
    if (viewMode === 'messages' && messages) return undefined;
    if (viewMode === 'homework' && printDays) return undefined;

    autoDownloadKeyRef.current = autoDownloadKey;
    const timer = window.setTimeout(() => {
      if (viewMode === 'schedule') retrieveSchedule();
      else if (viewMode === 'grades') retrieveGrades();
      else if (viewMode === 'messages') retrieveMessages();
      else run();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [busy, downloadedDataByEleve, getDownloadedData, grades, gradesBusy, isLoggedIn, eleveModal?.selectedId, messages, messagesBusy, printDays, retrieveGrades, retrieveMessages, retrieveSchedule, run, scheduleBusy, scheduleEvents.length, selectedEleveIdRef, viewMode]);

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
    messages,
    messagesBusy,
    messagesQuery,
    retrieveMessages,
    searchMessages,
    loadMessage,
    viewMode,
    switchView,
    selectView,
    retrieveSchedule,
    retrieveGrades,
    retrievePreviousHomework,
    openDocument,
    buildPrintHtml,
    run,
    printHomework,
    afterPrint,
    disconnect,
    restoreFromStorage,
  };
}
