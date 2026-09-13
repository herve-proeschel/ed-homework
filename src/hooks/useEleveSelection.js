import { useCallback, useRef, useState } from 'react';
import { getEleveAccounts } from '../services/edClient';

export function useEleveSelection({ runRef }) {
  const [eleveModal, setEleveModal] = useState(null); // { eleves, selectedId }
  const eleveResolverRef = useRef(null);
  const eleveListRef = useRef([]);
  const selectedEleveIdRef = useRef(null);

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
      if (prev) {
        selectedEleveIdRef.current = prev.selectedId;
        if (eleveResolverRef.current) {
          eleveResolverRef.current(prev.selectedId);
        } else {
          runRef.current?.();
        }
        eleveResolverRef.current = null;
      }
      return prev;
    });
  }, [runRef]);

  const chooseEleve = useCallback(
    async (accountData) => {
      const eleves = getEleveAccounts(accountData);
      eleveListRef.current = eleves;
      if (eleves.length === 0) return null;
      return askEleve(eleves);
    },
    [askEleve],
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
