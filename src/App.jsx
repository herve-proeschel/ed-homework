import { useEffect } from 'react';
import './App.css';
import StatusMessage from './components/StatusMessage';
import QcmModal from './components/QcmModal';
import EleveModal from './components/EleveModal';
import HomeWorkView from './components/HomeWorkView';
import PrintAction from './components/PrintAction';
import ThemeMenu from './components/ThemeMenu';
import LoginForm from './components/LoginForm';
import LoggedUser from './components/LoggedUser';
import { useHomeworkPrinter } from './hooks/useHomeworkPrinter';
import ScheduleView from './components/ScheduleView';

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
    scheduleEvents,
    scheduleBusy,
    hasMoreSchedule,
    viewMode,
    switchView,
    retrieveSchedule,
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
          {isLoggedIn && <LoggedUser displayName={displayName} username={username} onDisconnect={disconnect} />}
          <h1><button type="button" className="title-switch" onClick={switchView}>{viewMode === 'homework' ? 'Cahier de Texte' : 'Emploi du temps'}</button></h1>
          <ThemeMenu />
        </div>

        {!isLoggedIn && (
          <LoginForm
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            onSubmit={run}
            busy={busy}
          />
        )}

        <QcmModal qcm={qcm} onAnswer={answerQcm} />
        <div className={`student-status-toolbar${eleveModal?.confirmed ? ' student-status-toolbar--closed' : ''}`}>
          <EleveModal eleveModal={eleveModal} onSelect={selectEleve} onReopen={reopenEleve} />
          {isLoggedIn && (
            <div className="action-status-row">
              <StatusMessage
                message={status}
                isError={statusIsError}
                emptyMessage={viewMode === 'schedule' ? 'Téléchargez l’emploi du temps.' : 'Téléchargez les devoirs.'}
              />
              <PrintAction
                onRetrieve={viewMode === 'schedule' ? retrieveSchedule : eleveModal && !eleveModal.confirmed ? confirmEleve : run}
                onPrint={printHomework}
                canPrint={Boolean(viewMode === 'schedule' ? scheduleEvents.length : printDays?.length)}
                mode={viewMode}
                busy={viewMode === 'schedule' ? scheduleBusy : busy && (!eleveModal || eleveModal.confirmed)}
                compact
              />
            </div>
          )}
        </div>

        {!isLoggedIn && <StatusMessage message={status || 'Pas connecté. Connexion requise.'} isError={statusIsError} />}
      </div>

      {viewMode === 'schedule' ? <ScheduleView events={scheduleEvents} hasMore={hasMoreSchedule} loading={scheduleBusy} onLoadMore={retrieveSchedule} /> : <HomeWorkView days={printDays} />}
    </>
  );
}

export default App;
