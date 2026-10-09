import ThemeMenu from './ThemeMenu';
import LoggedUser from './LoggedUser';

const VIEW_TITLES = { homework: 'Cahier de Texte', schedule: 'Emploi du temps', grades: 'Notes', messages: 'Mes Messages' };

function getEleveFirstName(eleve) {
  return String(eleve?.prenom || '').trim();
}

export default function AppHeader({
  viewMode,
  onSelectView,
  onSwitchView,
  isLoggedIn,
  displayName,
  username,
  selectedEleve,
  eleveModal,
  onSelectEleve,
  onDisconnect,
}) {
  const eleveFirstName = getEleveFirstName(selectedEleve);
  const hasManagedEleves = (eleveModal?.eleves?.length || 0) > 0;
  const title = viewMode === 'messages'
    ? VIEW_TITLES.messages
    : `${VIEW_TITLES[viewMode]}${hasManagedEleves && eleveFirstName ? ` de ${eleveFirstName}` : ''}`;

  return (
    <div className={`app-header${isLoggedIn ? ' app-header--logged-in' : ''}`}>
      <ThemeMenu
        viewMode={viewMode}
        onSelectView={onSelectView}
        title={title}
        eleveModal={eleveModal}
        onSelectEleve={onSelectEleve}
      />
      <h1><button type="button" className="title-switch" onClick={onSwitchView}>{title}</button></h1>
      {isLoggedIn && <LoggedUser displayName={displayName} username={username} onDisconnect={onDisconnect} />}
    </div>
  );
}
