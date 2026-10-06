import { describe, expect, it } from 'vitest';
import {
  buildDocumentEndpoint,
  escapeHtml,
  getHomeworkDocumentSections,
  getHomeworkSession,
} from './homeworkDocuments';

describe('homework document helpers', () => {
  it('builds the ÉcoleDirecte document endpoint from a file id', () => {
    expect(buildDocumentEndpoint(766)).toBe(
      'v3/telechargement.awp?verbe=get&fichierId=766&leTypeDeFichier=FICHIER_CDT&v=4.103.0',
    );
  });

  it('reads documents from both homework and session sections', () => {
    const subject = {
      aFaire: {
        documents: [{ id: 781, libelle: 'Consigne.pdf' }],
        contenuDeSeance: {
          contenu: 'encoded session content',
          documents: [{ id: 782, libelle: 'Cours.pdf' }],
        },
      },
    };

    expect(getHomeworkDocumentSections(subject)).toEqual({
      homework: [{ id: 781, libelle: 'Consigne.pdf' }],
      session: [{ id: 782, libelle: 'Cours.pdf' }],
    });
    expect(getHomeworkSession(subject)).toMatchObject({
      contenu: 'encoded session content',
      documents: [{ id: 782, libelle: 'Cours.pdf' }],
    });
  });

  it('merges top-level and nested session documents without duplicate ids', () => {
    const subject = {
      contenuDeSeance: {
        contenu: 'top-level content',
        documents: [{ id: 781 }],
      },
      aFaire: {
        contenuDeSeance: {
          documents: [{ id: 781 }, { id: 782 }],
        },
      },
    };

    expect(getHomeworkDocumentSections(subject).session.map((document) => document.id)).toEqual([781, 782]);
    expect(getHomeworkSession(subject).contenu).toBe('top-level content');
  });

  it('escapes labels and URLs used in printable links', () => {
    expect(escapeHtml(`A & B <cours> "1"`)).toBe('A &amp; B &lt;cours&gt; &quot;1&quot;');
  });
});
