import { useEffect } from 'react';
import './App.css';
import StatusMessage from './components/StatusMessage';
import QcmModal from './components/QcmModal';
import EleveModal from './components/EleveModal';
import PrintView from './components/PrintView';
import { useHomeworkPrinter } from './hooks/useHomeworkPrinter';

function App() {
  const {
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
    printHomework,
    afterPrint,
    disconnect,
    restoreFromStorage,
  } = useHomeworkPrinter();

  useEffect(() => {
    restoreFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, [afterPrint]);

  return (
    <>
      <div className="container" id="appContainer">
        <h1>Cahier de Texte</h1>

        {!isLoggedIn && (
          <>
            <div className="form-group">
              <label htmlFor="username">Identifiant ÉcoleDirecte</label>
              <input
                type="text"
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Mot de passe</label>
              <input
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="button" className="main-btn" onClick={run} disabled={busy}>
              Connectez vous
            </button>
          </>
        )}

        {isLoggedIn && (
          <div className="logged-in-bar">
            <span>
              Connecté en tant que <strong>{username}</strong>
            </span>
            <button type="button" className="logout-btn" onClick={disconnect} title="Se déconnecter" aria-label="Se déconnecter">
              ⎋
            </button>
          </div>
        )}

        <QcmModal qcm={qcm} onAnswer={answerQcm} />
        <EleveModal
          eleveModal={eleveModal}
          onSelect={selectEleveOption}
          onConfirm={confirmEleve}
          onPrint={printHomework}
          canPrint={!!printDays}
        />

        <StatusMessage message={status} isError={statusIsError} />
      </div>

      <PrintView days={printDays} buildPrintHtml={buildPrintHtml} />
    </>
  );
}

export default App;
