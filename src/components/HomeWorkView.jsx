import { useEffect, useMemo, useRef, useState } from 'react';
import { decodeBase64Utf8 } from '../services/edClient';
import { formatDay } from '../utils/formatDay';
import {
  getHomeworkDocumentLabel,
  getHomeworkDocumentFilename,
  getHomeworkDocumentSections,
  getHomeworkDocumentUrl,
  getHomeworkSession,
} from '../utils/homeworkDocuments';
import {
  getHomeworkDisplayDays,
  getHomeworkSubjectOptions,
  getSubjectHomeworkTimeline,
  hasHomeworkSubjectContent,
} from '../utils/homework';

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
              download={getHomeworkDocumentFilename(document)}
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

export default function HomeWorkView({
  days,
  historyDays = null,
  filterOpen = true,
  selectedSubject: selectedSubjectProp,
  onSubjectChange,
  onOpenDocument,
  onOpenAi,
  onLoadPreviousWeek,
  onLoadHomeworkHistory,
  homeworkHistoryBusy = false,
}) {
  const viewRef = useRef(null);
  const touchStartRef = useRef(null);
  const filterRef = useRef(null);
  const [internalSelectedSubject, setInternalSelectedSubject] = useState('');
  const selectedSubject = selectedSubjectProp === undefined
    ? internalSelectedSubject
    : selectedSubjectProp;
  const subjectOptions = useMemo(
    () => getHomeworkSubjectOptions([...(days || []), ...(historyDays || [])]),
    [days, historyDays],
  );
  const activeSubject = filterOpen && subjectOptions.some((subject) => subject.key === selectedSubject)
    ? selectedSubject
    : '';
  const visibleDays = useMemo(
    () => getHomeworkDisplayDays(days, historyDays, activeSubject, filterOpen),
    [activeSubject, days, filterOpen, historyDays],
  );
  const activeSubjectTimeline = useMemo(
    () => (activeSubject ? getSubjectHomeworkTimeline(days, historyDays, activeSubject) : []),
    [activeSubject, days, historyDays],
  );

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return undefined;

    const preventPullToRefresh = (event) => {
      const start = touchStartRef.current;
      const touch = event.touches[0];
      if (!start || !touch || !start.atTop) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (deltaY > 0 && deltaY > Math.abs(deltaX)) {
        event.preventDefault();
      }
    };

    view.addEventListener('touchmove', preventPullToRefresh, { passive: false });
    return () => view.removeEventListener('touchmove', preventPullToRefresh);
  }, [days]);

  useEffect(() => {
    const topbar = document.querySelector('.app-topbar');
    const filter = filterRef.current;
    if (!topbar || !filter) return undefined;

    const updateStickyTop = () => {
      filter.style.setProperty('--homework-filter-sticky-top', `${topbar.getBoundingClientRect().height}px`);
    };
    updateStickyTop();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateStickyTop);
    observer.observe(topbar);
    return () => observer.disconnect();
  }, [filterOpen]);

  const handleTouchStart = (event) => {
    const touch = event.changedTouches[0];
    if (!touch || event.target?.closest?.('a, button, input, textarea, select, [role="dialog"], .theme-menu-popover')) {
      touchStartRef.current = null;
      return;
    }
    const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      atTop: scrollTop <= 0,
    };
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const swipeThreshold = 50;
    const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
    if (!start.atTop || scrollTop > 0 || deltaY < swipeThreshold || deltaY <= Math.abs(deltaX)) return;
    onLoadPreviousWeek?.();
  };

  if (!days) return null;
  return (
    <div ref={viewRef} id="printView" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {filterOpen && (subjectOptions.length > 0 || onLoadHomeworkHistory) && (
        <div className="homework-filter" ref={filterRef}>
          <label htmlFor="homework-subject-filter">Filtrer par matière</label>
          <select
            id="homework-subject-filter"
            value={activeSubject}
            onFocus={() => onLoadHomeworkHistory?.()}
            onChange={(event) => {
              const subject = event.target.value;
              if (onSubjectChange) onSubjectChange(subject);
              else setInternalSelectedSubject(subject);
              if (subject) onLoadHomeworkHistory?.();
            }}
          >
            <option value="">Toutes les matières</option>
            {subjectOptions.map((subject) => (
              <option key={subject.key} value={subject.key}>{subject.label}</option>
            ))}
          </select>
          {activeSubject && onOpenAi && activeSubjectTimeline.length > 0 && (
            <button
              type="button"
              className="homework-theme-ai-btn"
              onClick={() => {
                const subjectObj = subjectOptions.find((s) => s.key === activeSubject);
                onOpenAi({
                  matiere: subjectObj ? subjectObj.label : activeSubject,
                  timeline: activeSubjectTimeline,
                  defaultTab: 'theme',
                });
              }}
              title="Synthétiser le cours et le thème à travers les séances récentes"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
              </svg>
              <span>Synthèse du thème ({activeSubjectTimeline.length} séance{activeSubjectTimeline.length > 1 ? 's' : ''})</span>
            </button>
          )}
          {homeworkHistoryBusy && <span className="homework-filter-status">Chargement des 30 derniers jours…</span>}
          {activeSubject && !homeworkHistoryBusy && (
            <span className="homework-filter-status">Historique des 30 derniers jours</span>
          )}
        </div>
      )}
      {activeSubject && visibleDays.length === 0 ? (
        <p className="homework-filter-empty">Aucun devoir pour cette matière sur les 30 derniers jours.</p>
      ) : visibleDays.map((day) => {
        const subjects = (day.matieres || []).filter(hasHomeworkSubjectContent);
        return (
          <div className="day-container" key={day.date}>
            <h2 className="day-title">{formatDay(day.date)}</h2>
            {day.loading ? (
              <p style={{ fontStyle: 'italic', color: '#666' }}>Téléchargement en cours</p>
            ) : subjects.length === 0 ? (
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
                    {onOpenAi && (aFaireHtml || contenuDeSeanceHtml) && (
                      <div className="subject-ai-actions">
                        <button
                          type="button"
                          className="homework-ai-btn"
                          onClick={() =>
                            onOpenAi({
                              matiere: m.matiere,
                              date: day.date,
                              aFaireHtml,
                              contenuDeSeanceHtml,
                              timeline: getSubjectHomeworkTimeline(days, historyDays, m.matiere),
                            })
                          }
                          title="Demander une explication ou de l'aide à Gemini"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                          </svg>
                          <span>Aide IA</span>
                        </button>
                      </div>
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
