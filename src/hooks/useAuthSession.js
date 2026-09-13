import { useCallback, useRef, useState } from 'react';
import { EdClient, decodeBase64Utf8 } from '../services/edClient';
import {
  saveSession,
  restoreSession,
  clearSession,
  getSavedUsername,
  getSavedFa,
  saveFa,
} from '../services/sessionStorage';

export function useAuthSession({ logStatus, eleveListRef, selectedEleveIdRef, setEleveModal, setPrintDays }) {
  const clientRef = useRef(new EdClient());
  const [username, setUsername] = useState(() => getSavedUsername());
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');

  const [qcm, setQcm] = useState(null); // { question, options }
  const qcmResolverRef = useRef(null);

  const restoreFromStorage = useCallback(() => {
    const saved = restoreSession();
    if (!saved) return;
    clientRef.current.restoreState(saved);
    selectedEleveIdRef.current = saved.selectedEleveId;
    eleveListRef.current = saved.eleveList || [];
    if (eleveListRef.current.length > 0) {
      setEleveModal({
        eleves: eleveListRef.current,
        selectedId: String(saved.selectedEleveId ?? eleveListRef.current[0].id),
      });
    }
    setDisplayName(saved.displayName || '');
    setIsLoggedIn(true);
    logStatus('Session restaurée, prêt à imprimer.');
  }, [logStatus, eleveListRef, selectedEleveIdRef, setEleveModal]);

  const persistSession = useCallback(() => {
    const clientState = clientRef.current.getState();
    saveSession({
      ...clientState,
      selectedEleveId: selectedEleveIdRef.current,
      eleveList: eleveListRef.current,
      displayName,
    });
  }, [displayName, eleveListRef, selectedEleveIdRef]);

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

        logStatus('Réinitialisation de la session (GTK)...');
        await clientRef.current.initGtk();

        logStatus('Reprise de l’authentification...');
        const finalLogin = await clientRef.current.login(username, password, fa);
        qcmResolverRef.current?.resolve(finalLogin.data);
      } catch (err) {
        qcmResolverRef.current?.reject(err);
      }
    },
    [username, password, logStatus],
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

  const handleSessionExpired = useCallback(
    (msg = 'Votre session a expiré après une période d’inactivité. Veuillez saisir votre mot de passe pour vous reconnecter.') => {
      clientRef.current = new EdClient();
      setIsLoggedIn(false);
      selectedEleveIdRef.current = null;
      eleveListRef.current = [];
      setEleveModal(null);
      setPrintDays(null);
      clearSession();
      logStatus(msg, true);
    },
    [logStatus, eleveListRef, selectedEleveIdRef, setEleveModal, setPrintDays],
  );

  const disconnect = useCallback(() => {
    clientRef.current = new EdClient();
    setIsLoggedIn(false);
    selectedEleveIdRef.current = null;
    eleveListRef.current = [];
    setEleveModal(null);
    setPrintDays(null);
    clearSession();
    setPassword('');
    setDisplayName('');
    logStatus('Vous êtes déconnecté.');
  }, [logStatus, eleveListRef, selectedEleveIdRef, setEleveModal, setPrintDays]);

  return {
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
  };
}
