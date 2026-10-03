const LABELS = { homework: 'devoirs', schedule: 'emploi du temps', grades: 'notes' };

export default function PrintAction({ onRetrieve, onPrint, canPrint, hasData = false, compact = false, mode = 'homework', busy = false }) {
  const label = LABELS[mode] || LABELS.homework;
  return (
    <div className={`action-row${compact ? ' action-row--compact' : ''}`}>
      <button
        type="button"
        className={compact ? 'action-icon-btn' : 'main-btn'}
        onClick={onRetrieve}
        title={canPrint || hasData ? `Actualiser ${label}` : `Télécharger ${label}`}
        aria-label={canPrint || hasData ? `Actualiser ${label}` : `Télécharger ${label}`}
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