import { useEffect } from 'react';
import './App.css';
import StatusMessage from './components/StatusMessage';
import QcmModal from './components/QcmModal';
import EleveModal from './components/EleveModal';
import HomeWorkView from './components/HomeWorkView';
import HomeworkActions from './components/HomeworkActions';
import ThemeMenu from './components/ThemeMenu';
import { useHomeworkPrinter } from './hooks/useHomeworkPrinter';

function App() {
  const {
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
        <div className="app-header">
          <h1>Cahier de Texte</h1>
          <ThemeMenu />
        </div>

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
              Connecté en tant que <strong>{displayName || username}</strong>
            </span>
            <button type="button" className="logout-btn" onClick={disconnect} title="Se déconnecter" aria-label="Se déconnecter">
              ⎋
            </button>
          </div>
        )}

        <QcmModal qcm={qcm} onAnswer={answerQcm} />
        <div className={`student-status-toolbar${eleveModal?.confirmed ? ' student-status-toolbar--closed' : ''}`}>
          <EleveModal eleveModal={eleveModal} onSelect={selectEleve} onReopen={reopenEleve} />
          {isLoggedIn && (
            <div className="action-status-row">
              <StatusMessage message={status} isError={statusIsError} />
              <HomeworkActions
                onRetrieve={eleveModal && !eleveModal.confirmed ? confirmEleve : run}
                onPrint={printHomework}
                canPrint={Boolean(printDays?.length)}
                compact
              />
            </div>
          )}
        </div>

        {!isLoggedIn && <StatusMessage message={status} isError={statusIsError} />}
      </div>

      <HomeWorkView days={printDays} />
    </>
  );
}

export default App;
