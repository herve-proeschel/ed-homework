import { useCallback, useState } from 'react';
import { decodeBase64Utf8 } from '../services/edClient';
import { formatDay } from '../utils/formatDay';
import {
  escapeHtml,
  getHomeworkDocumentLabel,
  getHomeworkDocumentFilename,
  getHomeworkDocumentSections,
  getHomeworkDocumentUrl,
  getHomeworkSession,
} from '../utils/homeworkDocuments';

export function usePrintHomework({ logStatus }) {
  const [printDays, setPrintDays] = useState(null);

  function buildPrintHtml(daysData) {
    function documentLinksHtml(documents) {
      const links = documents
        .map((document) => {
          const url = getHomeworkDocumentUrl(document);
          if (!url) return '';
          return `<li><a href="${escapeHtml(url)}" download="${escapeHtml(getHomeworkDocumentFilename(document))}">${escapeHtml(getHomeworkDocumentLabel(document))}</a></li>`;
        })
        .filter(Boolean)
        .join('');
      return links
        ? `<hr class="subject-documents-separator"><h4 class="subject-documents-title">Documents</h4><ul class="subject-documents">${links}</ul>`
        : '';
    }

    let contentHtml = '';
    daysData.forEach((day) => {
      contentHtml += `<div class="day-container"><h2 class="day-title">${formatDay(day.date)}</h2>`;
      let hwCount = 0;
      (day.matieres || []).forEach((m) => {
        const aFaire = m.aFaire;
        const session = getHomeworkSession(m);
        const documents = getHomeworkDocumentSections(m);
        if (!aFaire && !session?.contenu && !documents.homework.length && !documents.session.length) return;
        hwCount++;
        const detailsHtml = decodeBase64Utf8(aFaire ? aFaire.contenu : '');
        const sessionHtml = decodeBase64Utf8(session?.contenu || '');
        const dateDonne = aFaire && aFaire.donneLe ? `(Donné le ${formatDay(aFaire.donneLe)})` : '';
        const isEval = aFaire && aFaire.interrogation ? '<span class="badge-eval">Contrôle</span>' : '';
        const homeworkHtml = aFaire
          ? `<h3 class="subject-section-title">À faire</h3><div class="subject-content">${detailsHtml || '<em>Sans consigne écrite</em>'}</div>${documentLinksHtml(documents.homework)}`
          : '';
        const sessionContentHtml = sessionHtml || documents.session.length
          ? '<hr class="subject-section-separator"><h3 class="subject-section-title">Contenu de séance</h3>' +
            `${sessionHtml ? `<div class="subject-content">${sessionHtml}</div>` : ''}${documentLinksHtml(documents.session)}`
          : '';
        contentHtml += `
          <div class="subject-box">
            <div class="subject-header">
              <span class="subject-title">${m.matiere || 'Matière'}</span>
              <span class="subject-meta">${dateDonne} ${isEval}</span>
            </div>
            ${homeworkHtml}
            ${sessionContentHtml}
          </div>`;
      });
      if (hwCount === 0) {
        contentHtml += `<p style="font-style: italic; color: #666;">Aucun travail spécifique pour ce jour.</p>`;
      }
      contentHtml += `</div>`;
    });
    return contentHtml;
  }

  const printHomework = useCallback(() => {
    window.print();
  }, []);

  const afterPrint = useCallback(() => {
    logStatus('Impression terminée.');
  }, [logStatus]);

  return { printDays, setPrintDays, buildPrintHtml, printHomework, afterPrint };
}
