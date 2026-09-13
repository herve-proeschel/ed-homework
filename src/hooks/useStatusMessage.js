import { useCallback, useState } from 'react';

export function useStatusMessage() {
  const [status, setStatus] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);

  const logStatus = useCallback((msg, isError = false) => {
    setStatus(msg);
    setStatusIsError(isError);
  }, []);

  return { status, statusIsError, logStatus };
}
