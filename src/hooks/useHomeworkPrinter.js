import { useCallback, useRef, useState } from 'react';
import { EdClient, decodeBase64Utf8, getEleveAccounts } from '../services/edClient';
import {
  saveSession,
  restoreSession,
  clearSession,
  getSavedUsername,
  saveUsername,
  getSavedFa,
  saveFa,
} from '../services/sessionStorage';

export function useHomeworkPrinter() {
  const clientRef = useRef(new EdClient());
  const [username, setUsername] = useState(() => getSavedUsername());
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);

  const [qcm, setQcm] = useState(null); // { question, options }
  const qcmResolverRef = useRef(null);

  const [eleveModal, setEleveModal] = useState(null); // { eleves, selectedId }
  const eleveResolverRef = useRef(null);

  const [printDays, setPrintDays] = useState(null);

  const eleveListRef = useRef([]);
  const selectedEleveIdRef = useRef(null);

  const logStatus = useCallback((msg, isError = false) => {
    setStatus(msg);
    setStatusIsError(isError);
  }, []);

  const restoreFromStorage = useCallback(() => {
    const saved = restoreSession();
    if (!saved) return;
    clientRef.current.restoreState(saved);
    selectedEleveIdRef.current = saved.selectedEleveId;
    eleveListRef.current = saved.eleveList || [];
    setIsLoggedIn(true);
    logStatus('Session restaurée, prêt à imprimer.');
  }, [logStatus]);

  const persistSession = useCallback(() => {
    const clientState = clientRef.current.getState();
    saveSession({
      ...clientState,
      selectedEleveId: selectedEleveIdRef.current,
      eleveList: eleveListRef.current,
    });
  }, []);

  const askQcm = useCallback((question, options) => {
    return new Promise((resolve, reject) => {
      qcmResolverRef.current = { resolve, reject };
      setQcm({ question, options });
    });
  }, []);

  const answerQcm = useCallback(
    async (choice) => {
      try {
        const answerRes = await clientRef.current.answerQcm(choice);
        setQcm(null);

        let fa = null;
        if (answerRes.data && answerRes.data.cn && answerRes.data.cv) {
          fa = [answerRes.data];
          saveFa(fa);
        }

        const finalLogin = await clientRef.current.login(username, password, fa);
        qcmResolverRef.current?.resolve(finalLogin.data);
      } catch (err) {
        qcmResolverRef.current?.reject(err);
      }
    },
    [username, password],
  );

  const askEleve = useCallback((eleves) => {
    return new Promise((resolve) => {
      eleveResolverRef.current = resolve;
      setEleveModal({ eleves, selectedId: String(eleves[0]?.id ?? '') });
    });
  }, []);

  const selectEleveOption = useCallback((id) => {
    setEleveModal((prev) => (prev ? { ...prev, selectedId: id } : prev));
  }, []);

  const confirmEleve = useCallback(() => {
    setEleveModal((prev) => {
      if (prev) eleveResolverRef.current?.(prev.selectedId);
      return null;
    });
  }, []);

  const chooseEleve = useCallback(
    async (accountData) => {
      const eleves = getEleveAccounts(accountData);
      eleveListRef.current = eleves;
      if (eleves.length === 0) return null;
      return askEleve(eleves);
    },
    [askEleve],
  );

  const performLogin = useCallback(async () => {
    logStatus('Initialisation session (GTK)...');
    await clientRef.current.initGtk();

    logStatus('Authentification...');
    const fa = getSavedFa();
    const res = await clientRef.current.login(username, password, fa);

    if (res.code === 250) {
      logStatus('Question de sécurité (2FA requise)...');
      const qcmRes = await clientRef.current.getQcm();
      if (qcmRes.code !== 200 || !qcmRes.data) {
        throw new Error('Impossible de charger la question de sécurité.');
      }
      const question = decodeBase64Utf8(qcmRes.data.question);
      const options = (qcmRes.data.propositions || []).map((p) => ({
        value: p,
        label: decodeBase64Utf8(p),
      }));
      return askQcm(question, options);
    }

    if (res.code !== 200 || !res.token) {
      throw new Error(res.message || 'Identifiant ou mot de passe invalide.');
    }

    return res.data;
  }, [username, password, logStatus, askQcm]);

  function buildPrintHtml(daysData) {
    let contentHtml = '';
    daysData.forEach((day) => {
      contentHtml += `<div class="day-container"><h2 class="day-title">${formatDay(day.date)}</h2>`;
      let hwCount = 0;
      (day.matieres || []).forEach((m) => {
        const aFaire = m.aFaire;
        if (!aFaire && (!m.contenuDeSeance || !m.contenuDeSeance.contenu)) return;
        hwCount++;
        const detailsHtml = decodeBase64Utf8(aFaire ? aFaire.contenu : '');
        const dateDonne = aFaire && aFaire.donneLe ? `(Donné le ${formatDay(aFaire.donneLe)})` : '';
        const isEval = aFaire && aFaire.interrogation ? '<span class="badge-eval">Contrôle</span>' : '';
        contentHtml += `
          <div class="subject-box">
            <div class="subject-header">
              <span class="subject-title">${m.matiere || 'Matière'}</span>
              <span class="subject-meta">${dateDonne} ${isEval}</span>
            </div>
            <div class="subject-content">${detailsHtml || '<em>Sans consigne écrite</em>'}</div>
          </div>`;
      });
      if (hwCount === 0) {
        contentHtml += `<p style="font-style: italic; color: #666;">Aucun travail spécifique pour ce jour.</p>`;
      }
      contentHtml += `</div>`;
    });
    return contentHtml;
  }

  function formatDay(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d
      .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .toUpperCase();
  }

  const run = useCallback(async () => {
    if (!username || (!isLoggedIn && !password)) {
      logStatus('Veuillez renseigner votre identifiant et mot de passe.', true);
      return;
    }

    saveUsername(username);
    setBusy(true);

    try {
      let eleveId = selectedEleveIdRef.current;

      if (!isLoggedIn) {
        const accountData = await performLogin();
        logStatus("Sélection de l'élève...");
        eleveId = await chooseEleve(accountData);

        if (!eleveId) throw new Error('Profil élève introuvable sur ce compte.');

        selectedEleveIdRef.current = eleveId;
        setIsLoggedIn(true);
        persistSession();
      }

      logStatus('Lecture du planning du cahier de texte...');
      const listRes = await clientRef.current.getCahierDeTexte(eleveId);

      if (listRes.code !== 200 || !listRes.data) {
        throw new Error(listRes.message || 'Erreur lors de la lecture du cahier de texte.');
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const futureDates = Object.keys(listRes.data).filter((d) => d > todayStr).sort();

      if (futureDates.length === 0) {
        logStatus('Aucun devoir programmé pour les jours suivants.');
        setBusy(false);
        return;
      }

      const detailedDays = [];
      for (let i = 0; i < futureDates.length; i++) {
        const date = futureDates[i];
        logStatus(`Collecte (${i + 1}/${futureDates.length}) : ${date}...`);
        const detail = await clientRef.current.getCahierDeTexteDetail(eleveId, date);
        if (detail && detail.code === 200 && detail.data) {
          detailedDays.push(detail.data);
        }
      }

      logStatus("Génération de la vue d'impression...");
      setPrintDays(detailedDays);
      setTimeout(() => window.print(), 300);
    } catch (err) {
      console.error(err);
      logStatus('Erreur : ' + err.message, true);
      setBusy(false);
    }
  }, [username, password, isLoggedIn, performLogin, chooseEleve, persistSession, logStatus]);

  const afterPrint = useCallback(async () => {
    setPrintDays(null);
    setBusy(false);
    if (isLoggedIn && eleveListRef.current.length > 0) {
      logStatus('Choisissez un autre élève ou relancez l\'impression.');
      const eleveId = await askEleve(eleveListRef.current);
      if (eleveId) {
        selectedEleveIdRef.current = eleveId;
        persistSession();
        run();
      }
    }
  }, [isLoggedIn, logStatus, askEleve, persistSession, run]);

  const reconnect = useCallback(() => {
    clientRef.current = new EdClient();
    setIsLoggedIn(false);
    selectedEleveIdRef.current = null;
    eleveListRef.current = [];
    clearSession();
    setPassword('');
    logStatus('Veuillez ressaisir votre mot de passe pour vous reconnecter.');
  }, [logStatus]);

  return {
    username,
    setUsername,
    password,
    setPassword,
    isLoggedIn,
    busy,
    status,
    statusIsError,
    qcm,
    answerQcm,
    eleveModal,
    selectEleveOption,
    confirmEleve,
    printDays,
    buildPrintHtml,
    run,
    afterPrint,
    reconnect,
    restoreFromStorage,
  };
}
