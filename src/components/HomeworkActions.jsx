export default function HomeworkActions({ onRetrieve, onPrint, canPrint, compact = false, mode = 'homework', busy = false }) {
  const isSchedule = mode === 'schedule';
  const label = isSchedule ? 'emploi du temps' : 'devoirs';
  return (
    <div className={`action-row${compact ? ' action-row--compact' : ''}`}>
      <button
        type="button"
        className={compact ? 'action-icon-btn' : 'main-btn'}
        onClick={onRetrieve}
        title={canPrint ? `Actualiser ${label}` : `Télécharger ${label}`}
        aria-label={canPrint ? `Actualiser ${label}` : `Télécharger ${label}`}
        disabled={busy}
      >
        {compact ? '⇩' : `Télécharger ${label}`}
      </button>
      {canPrint && (
        <button type="button" className="print-btn" onClick={onPrint} title={`Imprimer ${label}`} aria-label={`Imprimer ${label}`}>
          🖨️
        </button>
      )}
    </div>
  );
}