export default function EleveModal({ eleveModal, onSelect, onReopen }) {
  if (!eleveModal) return null;
  const { eleves, selectedId, confirmed } = eleveModal;
  const selectedEleve = eleves.find((eleve) => String(eleve.id) === String(selectedId));
  const selectedName = `${selectedEleve?.prenom || ''} ${selectedEleve?.nom || ''}`.trim();

  const toggleButton = (
    <button
      type="button"
      className="eleve-reopen-btn"
      onClick={onReopen}
      title={confirmed ? "Changer d'élève" : "Fermer la sélection"}
      aria-label={confirmed ? "Changer d'élève" : "Fermer la sélection"}
      aria-expanded={!confirmed}
    >
      &#9998;
    </button>
  );

  if (confirmed) {
    return (
      <div className="eleve-modal eleve-modal--collapsed">
        <strong>{selectedName}</strong>
        {toggleButton}
      </div>
    );
  }

  return (
    <div className="eleve-modal">
      <div className="eleve-modal-header">
        <p>
          <strong>Choisissez un élève :</strong>
        </p>
        {toggleButton}
      </div>
      <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
        {eleves.map((eleve) => (
          <option key={eleve.id} value={eleve.id}>
            {`${eleve.prenom || ''} ${eleve.nom || ''}`.trim()}
          </option>
        ))}
      </select>
    </div>
  );
}
