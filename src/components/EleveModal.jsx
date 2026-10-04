export default function EleveModal({ eleveModal, onSelect }) {
  if (!eleveModal) return null;
  const { eleves, selectedId, confirmed } = eleveModal;
  const selectedEleve = eleves.find((eleve) => String(eleve.id) === String(selectedId));
  const selectedName = `${selectedEleve?.prenom || ''} ${selectedEleve?.nom || ''}`.trim();
  const options = eleves.map((eleve) => (
    <option key={eleve.id} value={eleve.id}>
      {`${eleve.prenom || ''} ${eleve.nom || ''}`.trim()}
    </option>
  ));

  if (confirmed) {
    return (
      <div className="eleve-modal eleve-modal--collapsed">
        <select
          className="eleve-selected-name"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          title="Changer d'élève"
          aria-label={`Élève sélectionné : ${selectedName}. Ouvrir la liste des élèves`}
        >
          {options}
        </select>
      </div>
    );
  }

  return (
    <div className="eleve-modal">
      <div className="eleve-modal-header">
        <p>
          <strong>Choisissez un élève :</strong>
        </p>
      </div>
      <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
        {options}
      </select>
    </div>
  );
}
