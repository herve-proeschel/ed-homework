import { beforeEach, describe, expect, it } from 'vitest';
import {
  GEMINI_STORAGE_KEY,
  buildHomeworkPrompt,
  clearGeminiApiKey,
  formatGeminiError,
  getGeminiApiKey,
  maskGeminiApiKey,
  saveGeminiApiKey,
  stripHtml,
  validateGeminiApiKey,
  parseGeminiQuotaError,
  buildChatContents,
} from './geminiClient';

describe('geminiClient storage & helpers', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    };
  });

  it('saves, reads, and clears API key from localStorage', () => {
    expect(getGeminiApiKey()).toBe('');
    saveGeminiApiKey('AIzaSyTestKey1234567890');
    expect(getGeminiApiKey()).toBe('AIzaSyTestKey1234567890');
    expect(localStorage.getItem(GEMINI_STORAGE_KEY)).toBe('AIzaSyTestKey1234567890');

    clearGeminiApiKey();
    expect(getGeminiApiKey()).toBe('');
  });

  it('masks API key correctly', () => {
    expect(maskGeminiApiKey('')).toBe('');
    expect(maskGeminiApiKey('12345')).toBe('••••••••');
    expect(maskGeminiApiKey('AIzaSy123456789XYZ')).toBe('AIzaSy••••9XYZ');
  });

  it('strips HTML properly', () => {
    expect(stripHtml('<p>Exercice <strong>n°12</strong> page 45</p>')).toBe('Exercice n°12 page 45');
    expect(stripHtml('')).toBe('');
  });

  it('formats Gemini errors politely and extracts quota retry delays', () => {
    expect(formatGeminiError(new Error('API_KEY_INVALID'))).toContain('Clé API Gemini invalide');
    expect(formatGeminiError(new Error('RESOURCE_EXHAUSTED'))).toContain('Limite de requêtes atteinte');
    expect(formatGeminiError(new Error('Failed to fetch'))).toContain('Impossible de contacter');

    // Quota parsing from message
    const parsed1 = parseGeminiQuotaError(new Error('429 RESOURCE_EXHAUSTED: Please retry after 42s.'));
    expect(parsed1).toMatchObject({
      isQuota: true,
      isDaily: false,
      isTokenLimit: false,
      quotaType: 'RPM',
      retrySeconds: 42,
    });

    // Quota parsing from error details
    const parsed2 = parseGeminiQuotaError({
      status: 429,
      details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '35s' }],
    });
    expect(parsed2).toMatchObject({
      isQuota: true,
      isDaily: false,
      isTokenLimit: false,
      quotaType: 'RPM',
      retrySeconds: 35,
    });

    // Formatted with delay
    expect(formatGeminiError(new Error('429'), parsed1)).toContain('Réessai possible dans 42 secondes');

    // Unwrapping nested JSON Google errors
    const nestedGoogleError = new Error(
      '{"error":{"message":"{\\n  \\"error\\": {\\n    \\"code\\": 404,\\n    \\"message\\": \\"This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.\\",\\n    \\"status\\": \\"NOT_FOUND\\"\\n  }\\n}\\n","code":404,"status":""}}',
    );
    const formattedModelError = formatGeminiError(nestedGoogleError);
    expect(formattedModelError).toContain('Modèle Gemini indisponible');
    expect(formattedModelError).toContain('models/gemini-3.8-flash');
    expect(formattedModelError).not.toContain('{"error":');
  });

  it('builds homework prompt with context and promptType', () => {
    const prompt = buildHomeworkPrompt({
      subject: 'Mathématiques',
      assignmentHtml: '<p>Faire les exercices 1 et 2</p>',
      sessionHtml: '<p>Cours sur le théorème de Thalès</p>',
      promptType: 'explain',
    });

    expect(prompt).toContain('Matière : Mathématiques');
    expect(prompt).toContain('Consigne du devoir : Faire les exercices 1 et 2');
    expect(prompt).toContain('Contenu de séance / cours lié : Cours sur le théorème de Thalès');
    expect(prompt).toContain('Explique-moi simplement cette consigne');
  });

  it('builds quiz prompt with details/summary instruction', () => {
    const prompt = buildHomeworkPrompt({
      subject: 'Mathématiques',
      promptType: 'quiz',
    });
    expect(prompt).toContain('<details>');
    expect(prompt).toContain('<summary>');
    expect(prompt).toContain('mini-quiz');
  });

  it('builds theme prompt with multi-session timeline context', () => {
    const prompt = buildHomeworkPrompt({
      subject: 'Italien',
      promptType: 'theme',
      timeline: [
        {
          date: '2026-10-02',
          contenuDeSeanceHtml: '<p>Le pluriel des noms en -o et -a</p>',
          aFaireHtml: '<p>Exercice 1 p. 20</p>',
        },
        {
          date: '2026-10-06',
          contenuDeSeanceHtml: '<p>Les cas particuliers en -e et invariables</p>',
          aFaireHtml: '<p>Tableau récapitulatif</p>',
          interrogation: true,
        },
      ],
    });

    expect(prompt).toContain('Matière : Italien');
    expect(prompt).toContain('Historique récent des séances et devoirs dans cette matière (2 séances)');
    expect(prompt).toContain('Séance du 2026-10-02');
    expect(prompt).toContain('Le pluriel des noms en -o et -a');
    expect(prompt).toContain('[Évaluation / Contrôle]');
    expect(prompt).toContain('thème général du cours ou du chapitre actuel');
  });

  it('builds chat contents for single-turn and multi-turn conversations', () => {
    // Single turn
    const single = buildChatContents({
      subject: 'Mathématiques',
      promptType: 'explain',
      assignmentHtml: 'Exercice 1',
    });
    expect(single).toHaveLength(1);
    expect(single[0].role).toBe('user');
    expect(single[0].parts[0].text).toContain('Exercice 1');

    // Multi-turn with assistant response and student reply
    const multi = buildChatContents({
      subject: 'Mathématiques',
      promptType: 'quiz',
      history: [
        { role: 'assistant', text: 'Voici un quiz : 1. Calculer 2+2.' },
      ],
      newMessage: "J'ai trouvé 4, est-ce correct ?",
    });

    expect(multi).toHaveLength(3);
    expect(multi[0].role).toBe('user'); // Prompt initial avec contexte du devoir
    expect(multi[0].parts[0].text).toContain('mini-quiz');
    expect(multi[1].role).toBe('model'); // Réponse du tuteur (quiz)
    expect(multi[1].parts[0].text).toBe('Voici un quiz : 1. Calculer 2+2.');
    expect(multi[2].role).toBe('user'); // Réponse de l'élève
    expect(multi[2].parts[0].text).toBe("J'ai trouvé 4, est-ce correct ?");
  });

  it('validates empty key with an informative error', async () => {
    const result = await validateGeminiApiKey('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Veuillez saisir une clé API');
  });
});
