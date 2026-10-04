import { useCallback, useRef, useState } from 'react';
import { getEleveAccounts } from '../services/edClient';

export function useEleveSelection({ runRef }) {
  const [eleveModal, setEleveModal] = useState(null); // { eleves, selectedId, confirmed }
  const eleveListRef = useRef([]);
  const selectedEleveIdRef = useRef(null);

  const selectEleveOption = useCallback((id) => {
    setEleveModal((prev) => (prev ? { ...prev, selectedId: id, confirmed: true } : prev));
  }, []);

  const confirmEleve = useCallback(() => {
    setEleveModal((prev) => {
      if (prev) {
        selectedEleveIdRef.current = prev.selectedId;
        runRef.current?.();
        return { ...prev, confirmed: true };
      }
      return prev;
    });
  }, [runRef]);

  const chooseEleve = useCallback(
    async (accountData) => {
      const eleves = getEleveAccounts(accountData);
      eleveListRef.current = eleves;
      if (eleves.length === 0) {
        const studentAccount = accountData?.accounts?.[0];
        const studentId = studentAccount?.id;
        if (studentId == null) return null;
        selectedEleveIdRef.current = String(studentId);
        return String(studentId);
      }
      const firstEleveId = String(eleves[0].id);
      selectedEleveIdRef.current = firstEleveId;
      setEleveModal({ eleves, selectedId: firstEleveId, confirmed: true });
      return firstEleveId;
    },
    [],
  );

  return {
    eleveModal,
    setEleveModal,
    eleveListRef,
    selectedEleveIdRef,
    selectEleveOption,
    confirmEleve,
    chooseEleve,
  };
}
