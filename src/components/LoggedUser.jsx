import { useState } from 'react';

export default function LoggedUser({ displayName, username, onDisconnect }) {
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const userLabel = displayName || username;
  const userInitials = userLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  const handleDisconnect = () => {
    setIsDisconnectModalOpen(false);
    onDisconnect();
  };

  return (
    <>
      <button
        type="button"
        className="user-badge"
        onClick={() => setIsDisconnectModalOpen(true)}
        title={`Compte de ${userLabel}`}
        aria-label={`Compte de ${userLabel}. Ouvrir les options de déconnexion`}
      >
        {userInitials || '?'}
      </button>

      {isDisconnectModalOpen && (
        <div className="disconnect-modal-backdrop" role="presentation" onMouseDown={() => setIsDisconnectModalOpen(false)}>
          <div
            className="disconnect-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="disconnect-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="disconnect-modal-title">Se déconnecter ?</h2>
            <p>Voulez-vous vraiment vous déconnecter de {userLabel} ?</p>
            <div className="disconnect-modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setIsDisconnectModalOpen(false)}>
                Annuler
              </button>
              <button type="button" className="main-btn" onClick={handleDisconnect}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
