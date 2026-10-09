const LABELS = { homework: 'devoirs', schedule: 'emploi du temps', grades: 'notes', messages: 'messages' };

export default function PrintAction({ onRetrieve, onPrint, canPrint, hasData = false, compact = false, mode = 'homework', busy = false, onSearch, searchActive = false }) {
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
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
        ) : `Télécharger ${label}`}
      </button>
      {onSearch && (
        <button
          type="button"
          className={"print-btn"}
          onClick={onSearch}
          aria-pressed={searchActive}
          title="Rechercher"
          aria-label="Rechercher"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </button>
      )}
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