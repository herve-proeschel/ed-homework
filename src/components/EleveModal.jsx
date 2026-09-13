import HomeworkActions from './HomeworkActions';

export default function EleveModal({ eleveModal, onSelect, onConfirm, onPrint, canPrint }) {
  if (!eleveModal) return null;
  const { eleves, selectedId } = eleveModal;

  return (
    <div className="eleve-modal">
      <p>
        <strong>Choisissez un élève :</strong>
      </p>
      <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
        {eleves.map((eleve) => (
          <option key={eleve.id} value={eleve.id}>
            {`${eleve.prenom || ''} ${eleve.nom || ''}`.trim()}
          </option>
        ))}
      </select>
      <HomeworkActions onRetrieve={onConfirm} onPrint={onPrint} canPrint={canPrint} />
    </div>
  );
}
