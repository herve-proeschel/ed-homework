import { useCallback, useEffect, useRef } from 'react';
import { getAccountFullName, isSessionExpiredError } from '../services/edClient';
import { saveUsername } from '../services/sessionStorage';
import { useStatusMessage } from './useStatusMessage';
import { usePrintHomework } from './usePrintHomework';
import { useEleveSelection } from './useEleveSelection';
import { useAuthSession } from './useAuthSession';

export function useHomeworkPrinter() {
  const runRef = useRef(null);
  const downloadedDaysByEleveRef = useRef({});

  const { status, statusIsError, logStatus } = useStatusMessage();

  const { printDays, setPrintDays, buildPrintHtml, printHomework, afterPrint } = usePrintHomework({ logStatus });

  const { eleveModal, setEleveModal, eleveListRef, selectedEleveIdRef, selectEleveOption, reopenEleve, confirmEleve, chooseEleve } =
    useEleveSelection({ runRef });

  const selectEleve = useCallback(
    (id) => {
      selectEleveOption(id);
      const cachedDays = downloadedDaysByEleveRef.current[id] || null;
      setPrintDays(cachedDays);
      logStatus(cachedDays?.length ? 'Devoirs récupérés, prêts à imprimer.' : '');
    },
    [selectEleveOption, setPrintDays, logStatus],
  );

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
  } = useAuthSession({ logStatus, eleveListRef, selectedEleveIdRef, setEleveModal, setPrintDays });

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
  ]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

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
    buildPrintHtml,
    run,
    printHomework,
    afterPrint,
    disconnect,
    restoreFromStorage,
  };
}
