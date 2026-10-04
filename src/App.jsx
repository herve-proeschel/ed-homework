import { useEffect } from 'react';
import './App.css';
import StatusMessage from './components/StatusMessage';
import QcmModal from './components/QcmModal';
import EleveModal from './components/EleveModal';
import HomeWorkView from './components/HomeWorkView';
import PrintAction from './components/PrintAction';
import AppHeader from './components/AppHeader';
import LoginForm from './components/LoginForm';
import { AppProvider } from './context/AppProvider';
import { useAppContext } from './context/appContext';
import ScheduleView from './components/ScheduleView';
import GradesView from './components/GradesView';

const VIEW_EMPTY_MESSAGES = {
  homework: 'Téléchargez les devoirs.',
  schedule: 'Téléchargez l’emploi du temps.',
  grades: 'Téléchargez les notes.',
};

function AppContent() {
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
    grades,
    gradesBusy,
    viewMode,
    switchView,
    selectView,
    retrieveSchedule,
    retrieveGrades,
    run,
    printHomework,
    afterPrint,
    disconnect,
    restoreFromStorage,
  } = useAppContext();

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
        <div className="app-topbar">
          <AppHeader
            viewMode={viewMode}
            onSelectView={selectView}
            onSwitchView={switchView}
            isLoggedIn={isLoggedIn}
            displayName={displayName}
            username={username}
            onDisconnect={disconnect}
          />

          <div className={`student-status-toolbar${eleveModal?.confirmed ? ' student-status-toolbar--closed' : ''}`}>
            <EleveModal eleveModal={eleveModal} onSelect={selectEleve} onReopen={reopenEleve} />
            {isLoggedIn && (
              <div className="action-status-row">
                <StatusMessage
                  message={status}
                  isError={statusIsError}
                  emptyMessage={VIEW_EMPTY_MESSAGES[viewMode]}
                />
                <PrintAction
                  onRetrieve={viewMode === 'schedule' ? retrieveSchedule : viewMode === 'grades' ? retrieveGrades : eleveModal && !eleveModal.confirmed ? confirmEleve : run}
                  onPrint={printHomework}
                  canPrint={viewMode === 'grades' ? false : Boolean(viewMode === 'schedule' ? scheduleEvents.length : printDays?.length)}
                  hasData={viewMode === 'grades' && Boolean(grades)}
                  mode={viewMode}
                  busy={viewMode === 'schedule' ? scheduleBusy : viewMode === 'grades' ? gradesBusy : busy && (!eleveModal || eleveModal.confirmed)}
                  compact
                />
              </div>
            )}
          </div>
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

        {!isLoggedIn && <StatusMessage message={status || 'Pas connecté. Connexion requise.'} isError={statusIsError} />}
      </div>

      {viewMode === 'schedule' && <ScheduleView events={scheduleEvents} hasMore={hasMoreSchedule} loading={scheduleBusy} onLoadMore={retrieveSchedule} />}
      {viewMode === 'grades' && <GradesView grades={grades} />}
      {viewMode === 'homework' && <HomeWorkView days={printDays} />}
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
