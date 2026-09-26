export default function HomeworkActions({ onRetrieve, onPrint, canPrint, compact = false }) {
  return (
    <div className={`action-row${compact ? ' action-row--compact' : ''}`}>
      <button
        type="button"
        className={compact ? 'action-icon-btn' : 'main-btn'}
        onClick={onRetrieve}
        title={canPrint ? 'Actualiser les devoirs' : 'Récupérer les devoirs'}
        aria-label={canPrint ? 'Actualiser les devoirs' : 'Récupérer les devoirs'}
      >
        {compact ? (canPrint ? '↻' : '⇧') : 'Récupérer les devoirs'}
      </button>
      {canPrint && (
        <button type="button" className="print-btn" onClick={onPrint} title="Imprimer" aria-label="Imprimer">
          🖨️
        </button>
      )}
    </div>
  );
}