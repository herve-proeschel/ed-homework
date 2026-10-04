import ThemeMenu from './ThemeMenu';
import LoggedUser from './LoggedUser';

const VIEW_TITLES = { homework: 'Cahier de Texte', schedule: 'Emploi du temps', grades: 'Notes' };

export default function AppHeader({
  viewMode,
  onSelectView,
  onSwitchView,
  isLoggedIn,
  displayName,
  username,
  onDisconnect,
}) {
  return (
    <div className={`app-header${isLoggedIn ? ' app-header--logged-in' : ''}`}>
      <ThemeMenu viewMode={viewMode} onSelectView={onSelectView} />
      <h1><button type="button" className="title-switch" onClick={onSwitchView}>{VIEW_TITLES[viewMode]}</button></h1>
      {isLoggedIn && <LoggedUser displayName={displayName} username={username} onDisconnect={onDisconnect} />}
    </div>
  );
}
