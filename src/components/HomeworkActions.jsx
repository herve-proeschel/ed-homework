export default function HomeworkActions({ onRetrieve, onPrint, canPrint }) {
  return (
    <div className="action-row">
      <button type="button" className="main-btn" onClick={onRetrieve}>
        Récupérer les devoirs
      </button>
      {canPrint && (
        <button type="button" className="print-btn" onClick={onPrint} title="Imprimer" aria-label="Imprimer">
          🖨️
        </button>
      )}
    </div>
  );
}