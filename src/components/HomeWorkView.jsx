import { decodeBase64Utf8 } from '../services/edClient';
import { formatDay } from '../utils/formatDay';

export default function HomeWorkView({ days }) {
  if (!days) return null;
  return (
    <div id="printView">
      {days.map((day) => {
        const subjects = (day.matieres || []).filter(
          (m) => m.aFaire || m.contenuDeSeance?.contenu,
        );
        return (
          <div className="day-container" key={day.date}>
            <h2 className="day-title">{formatDay(day.date)}</h2>
            {subjects.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: '#666' }}>Aucun travail spécifique pour ce jour.</p>
            ) : (
              subjects.map((m, idx) => {
                const aFaire = m.aFaire;
                const aFaireHtml = decodeBase64Utf8(aFaire?.contenu ?? '');
                const contenuDeSeance = m.aFaire?.contenuDeSeance?.contenu;
                const contenuDeSeanceHtml = decodeBase64Utf8(contenuDeSeance ?? '');
                const dateDonne = aFaire?.donneLe ? `(Donné le ${formatDay(aFaire.donneLe)})` : '';
                return (
                  <div className="subject-box" key={`${m.matiere}-${idx}`}>
                    <div className="subject-header">
                      <span className="subject-title">{m.matiere || 'Matière'}</span>
                      <span className="subject-meta">
                        {dateDonne} {aFaire?.interrogation && <span className="badge-eval">Contrôle</span>}
                      </span>
                    </div>
                    {aFaire && (
                      <>
                        <h3 className="subject-section-title">À faire</h3>
                        <div className="subject-content">
                          {aFaireHtml ? (
                            // eslint-disable-next-line react/no-danger -- rich text markup from API data, not user input
                            <div dangerouslySetInnerHTML={{ __html: aFaireHtml }} />
                          ) : (
                            <em>Sans consigne écrite</em>
                          )}
                        </div>
                      </>
                    )}
                    {contenuDeSeance && (
                      <>
                        <hr className="subject-section-separator" />
                        <h3 className="subject-section-title">Contenu de séance</h3>
                        <div className="subject-content">
                          {/* eslint-disable-next-line react/no-danger -- rich text markup from API data, not user input */}
                          <div dangerouslySetInnerHTML={{ __html: contenuDeSeanceHtml }} />
                        </div>
                      </>
                    )}
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

