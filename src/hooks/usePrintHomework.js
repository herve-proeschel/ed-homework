import { useCallback, useState } from 'react';
import { decodeBase64Utf8 } from '../services/edClient';
import { formatDay } from '../utils/formatDay';

export function usePrintHomework({ logStatus }) {
  const [printDays, setPrintDays] = useState(null);

  function buildPrintHtml(daysData) {
    let contentHtml = '';
    daysData.forEach((day) => {
      contentHtml += `<div class="day-container"><h2 class="day-title">${formatDay(day.date)}</h2>`;
      let hwCount = 0;
      (day.matieres || []).forEach((m) => {
        const aFaire = m.aFaire;
        if (!aFaire && (!m.contenuDeSeance || !m.contenuDeSeance.contenu)) return;
        hwCount++;
        const detailsHtml = decodeBase64Utf8(aFaire ? aFaire.contenu : '');
        const dateDonne = aFaire && aFaire.donneLe ? `(Donné le ${formatDay(aFaire.donneLe)})` : '';
        const isEval = aFaire && aFaire.interrogation ? '<span class="badge-eval">Contrôle</span>' : '';
        contentHtml += `
          <div class="subject-box">
            <div class="subject-header">
              <span class="subject-title">${m.matiere || 'Matière'}</span>
              <span class="subject-meta">${dateDonne} ${isEval}</span>
            </div>
            <div class="subject-content">${detailsHtml || '<em>Sans consigne écrite</em>'}</div>
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
