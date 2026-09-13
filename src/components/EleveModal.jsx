import { getElevePhotoSrc } from '../services/edClient';

export default function EleveModal({ eleveModal, onSelect, onConfirm }) {
  if (!eleveModal) return null;
  const { eleves, selectedId } = eleveModal;
  const selectedEleve = eleves.find((e) => String(e.id) === selectedId);
  const photoSrc = selectedEleve ? getElevePhotoSrc(selectedEleve) : '';

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
      <button type="button" className="main-btn" onClick={onConfirm}>
        Valider
      </button>
    </div>
  );
}
