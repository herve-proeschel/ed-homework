import { useEffect, useRef } from 'react';
import './App.css';
import StatusMessage from './components/StatusMessage';
import QcmModal from './components/QcmModal';
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
  const touchStartRef = useRef(null);
  const {
    username,
    setUsername,
    displayName,
    password,
    setPassword,
    isLoggedIn,
    selectedEleve,
    busy,
    status,
    statusIsError,
    qcm,
    answerQcm,
    eleveModal,
    selectEleve,
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
    openDocument,
    run,
    printHomework,
    afterPrint,
    disconnect,
    restoreFromStorage,
  } = useAppContext();

  const handleTouchStart = (event) => {
    const touch = event.changedTouches[0];
    if (!touch || event.target?.closest?.('input, textarea, select, [role="dialog"], .theme-menu-popover')) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const swipeThreshold = 50;
    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    switchView(deltaX < 0 ? 1 : -1);
  };

  useEffect(() => {
    restoreFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, [afterPrint]);

  return (
    <div className="app-shell" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="app-topbar">
          <AppHeader
            viewMode={viewMode}
            onSelectView={selectView}
            onSwitchView={switchView}
            isLoggedIn={isLoggedIn}
            displayName={displayName}
            username={username}
            selectedEleve={selectedEleve}
            eleveModal={eleveModal}
            onSelectEleve={selectEleve}
            onDisconnect={disconnect}
          />

          <div className={`student-status-toolbar${eleveModal?.confirmed ? ' student-status-toolbar--closed' : ''}`}>
            {isLoggedIn && (
              <div className="action-status-row">
                <StatusMessage
                  message={status}
                  isError={statusIsError}
                  emptyMessage={VIEW_EMPTY_MESSAGES[viewMode]}
                />
              </div>
            )}
          </div>
        </div>

      {isLoggedIn && (
        <div className="app-floating-actions">
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

      <div className={`container${isLoggedIn ? ' app-container--logged-in' : ''}`} id="appContainer">
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
      {viewMode === 'homework' && <HomeWorkView days={printDays} onOpenDocument={openDocument} />}
    </div>
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
