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
        {compact ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" />
          </svg>
        ) : `Télécharger ${label}`}
      </button>
      {canPrint && (
        <button type="button" className="print-btn" onClick={onPrint} title={`Imprimer ${label}`} aria-label={`Imprimer ${label}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
          </svg>
        </button>
      )}
    </div>
  );
}