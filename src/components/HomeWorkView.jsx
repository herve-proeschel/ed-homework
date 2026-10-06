import { decodeBase64Utf8 } from '../services/edClient';
import { formatDay } from '../utils/formatDay';
import {
  getHomeworkDocumentLabel,
  getHomeworkDocumentSections,
  getHomeworkDocumentUrl,
  getHomeworkSession,
} from '../utils/homeworkDocuments';

function DocumentLinks({ documents, onOpenDocument }) {
  const links = documents
    .map((document) => ({ document, url: getHomeworkDocumentUrl(document) }))
    .filter(({ url }) => url);

  if (links.length === 0) return null;

  return (
    <>
      <hr className="subject-documents-separator" />
      <h4 className="subject-documents-title">Documents</h4>
      <ul className="subject-documents">
        {links.map(({ document, url }) => (
          <li key={document.id || document.fichierId}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (!onOpenDocument) return;
                event.preventDefault();
                onOpenDocument(document);
              }}
            >
              {getHomeworkDocumentLabel(document)}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function HomeWorkView({ days, onOpenDocument }) {
  if (!days) return null;
  return (
    <div id="printView">
      {days.map((day) => {
        const subjects = (day.matieres || []).filter((subject) => {
          const session = getHomeworkSession(subject);
          const documents = getHomeworkDocumentSections(subject);
          return subject.aFaire
            || session?.contenu
            || documents.homework.length > 0
            || documents.session.length > 0;
        });
        return (
          <div className="day-container" key={day.date}>
            <h2 className="day-title">{formatDay(day.date)}</h2>
            {subjects.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: '#666' }}>Aucun travail spécifique pour ce jour.</p>
            ) : (
              subjects.map((m, idx) => {
                const aFaire = m.aFaire;
                const aFaireHtml = decodeBase64Utf8(aFaire?.contenu ?? '');
                const session = getHomeworkSession(m);
                const contenuDeSeance = session?.contenu;
                const contenuDeSeanceHtml = decodeBase64Utf8(contenuDeSeance ?? '');
                const documents = getHomeworkDocumentSections(m);
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
                        <DocumentLinks documents={documents.homework} onOpenDocument={onOpenDocument} />
                      </>
                    )}
                    {(contenuDeSeance || documents.session.length > 0) && (
                      <>
                        <hr className="subject-section-separator" />
                        <h3 className="subject-section-title">Contenu de séance</h3>
                        {contenuDeSeance && (
                          <div className="subject-content">
                            {/* eslint-disable-next-line react/no-danger -- rich text markup from API data, not user input */}
                            <div dangerouslySetInnerHTML={{ __html: contenuDeSeanceHtml }} />
                          </div>
                        )}
                        <DocumentLinks documents={documents.session} onOpenDocument={onOpenDocument} />
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
