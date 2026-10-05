function StudentIcon() {
  return (
    <svg className="theme-option-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.8-3.4 3.3-5 7.5-5s6.7 1.6 7.5 5" />
    </svg>
  );
}

export default function EleveModal({ eleveModal, onSelect, menuItemRefs, itemOffset = 0 }) {
  if (!eleveModal) return null;
  const { eleves, selectedId } = eleveModal;

  return (
    <div className="eleve-modal eleve-modal--list" aria-label="Élèves disponibles">
      {eleves.map((eleve, index) => {
        const id = String(eleve.id);
        const name = `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || 'Élève';
        const isSelected = id === String(selectedId);
        return (
          <button
            type="button"
            role="menuitemradio"
            className="theme-option eleve-option"
            key={eleve.id}
            aria-checked={isSelected}
            ref={(element) => {
              if (menuItemRefs) menuItemRefs.current[itemOffset + index] = element;
            }}
            onClick={() => onSelect(id)}
          >
            <span className="theme-option-label">
              <StudentIcon />
              <span>{name}</span>
            </span>
            {isSelected && <span className="theme-option-check" aria-hidden="true">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
