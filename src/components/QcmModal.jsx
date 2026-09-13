export default function QcmModal({ qcm, onAnswer }) {
  if (!qcm) return null;
  return (
    <div className="qcm-modal">
      <p>
        <strong>Vérification de sécurité :</strong>
      </p>
      <p>{qcm.question}</p>
      <div>
        {qcm.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="qcm-option"
            onClick={() => onAnswer(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
