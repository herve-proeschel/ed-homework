import { decodeBase64Utf8 } from '../services/edClient';
import { formatDay } from '../utils/formatDay';

export default function HomeWorkView({ days }) {
  if (!days) return null;
  return (
    <div id="printView">
      <h1 style={{ textAlign: 'center' }}>Devoirs à venir</h1>
      {days.map((day) => {
        const subjects = (day.matieres || []).filter(
          (m) => m.aFaire || (m.contenuDeSeance && m.contenuDeSeance.contenu),
        );
        return (
          <div className="day-container" key={day.date}>
            <h2 className="day-title">{formatDay(day.date)}</h2>
            {subjects.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: '#666' }}>Aucun travail spécifique pour ce jour.</p>
            ) : (
              subjects.map((m, idx) => {
                const aFaire = m.aFaire;
                const detailsHtml = decodeBase64Utf8(aFaire ? aFaire.contenu : '');
                const dateDonne = aFaire && aFaire.donneLe ? `(Donné le ${formatDay(aFaire.donneLe)})` : '';
                return (
                  <div className="subject-box" key={`${m.matiere}-${idx}`}>
                    <div className="subject-header">
                      <span className="subject-title">{m.matiere || 'Matière'}</span>
                      <span className="subject-meta">
                        {dateDonne} {aFaire?.interrogation && <span className="badge-eval">Contrôle</span>}
                      </span>
                    </div>
                    <div className="subject-content">
                      {detailsHtml ? (
                        // eslint-disable-next-line react/no-danger -- rich text markup from API data, not user input
                        <div dangerouslySetInnerHTML={{ __html: detailsHtml }} />
                      ) : (
                        <em>Sans consigne écrite</em>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

