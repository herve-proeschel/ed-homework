import tutorSystemInstruction from './tutorSystemInstruction.md?raw';
import {
  getQuotaUnlockInfo,
  recordGeminiRequest,
  recordQuotaExceeded,
} from './geminiUsage';

export * from './geminiUsage';

export const GEMINI_STORAGE_KEY = 'ed_gemini_api_key';
export const GEMINI_MODEL = 'gemini-3.8-flash';
export const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];

export const TUTOR_SYSTEM_INSTRUCTION = tutorSystemInstruction.trim();

export function getGeminiApiKey() {
  try {
    if (typeof localStorage === 'undefined') return '';
    return (localStorage.getItem(GEMINI_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function saveGeminiApiKey(key) {
  const trimmed = (key || '').trim();
  if (!trimmed) {
    clearGeminiApiKey();
    return;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GEMINI_STORAGE_KEY, trimmed);
    }
  } catch {
    // ignore local storage errors
  }
}

export function clearGeminiApiKey() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(GEMINI_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function maskGeminiApiKey(key) {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 10) return '••••••••';
  return `${trimmed.slice(0, 6)}••••${trimmed.slice(-4)}`;
}

export function stripHtml(html) {
  if (!html) return '';
  // Supprimer les images base64 (data:image/...) qui peuvent gonfler le prompt de plusieurs mégaoctets
  const clean = html.replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/gi, '[image]');
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(clean, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return clean.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractCleanErrorMessage(error) {
  let message = error?.message || String(error || '');
  for (let i = 0; i < 3; i++) {
    const trimmed = (message || '').trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('{"') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.error?.message) {
          message = parsed.error.message;
        } else if (parsed?.message) {
          message = parsed.message;
        } else {
          break;
        }
      } catch {
        break;
      }
    } else {
      break;
    }
  }
  return (message || '').trim();
}

export function parseGeminiQuotaError(error) {
  if (!error) return null;
  const message = extractCleanErrorMessage(error);
  const rawMsg = error?.message || String(error || '');
  const status = error?.status || error?.code || error?.response?.status;
  const isQuota =
    status === 429 ||
    /RESOURCE_EXHAUSTED|429|quota exceeded|too many requests/i.test(message) ||
    /RESOURCE_EXHAUSTED|429|quota exceeded|too many requests/i.test(rawMsg);

  if (!isQuota) return null;

  const isDaily = /per day|requests per day|rpd|daily/i.test(message) || /per day|requests per day|rpd|daily/i.test(rawMsg);
  const isTokenLimit = /token|tokens per minute|tpm/i.test(message) || /token|tokens per minute|tpm/i.test(rawMsg);

  let retrySeconds = null;
  const details = error?.details || error?.errorDetails;
  if (Array.isArray(details)) {
    for (const item of details) {
      if (item?.retryDelay) {
        const raw = item.retryDelay;
        if (typeof raw === 'string') {
          const match = raw.match(/(\d+)/);
          if (match) retrySeconds = parseInt(match[1], 10);
        } else if (typeof raw?.seconds === 'number') {
          retrySeconds = raw.seconds;
        }
      }
    }
  }

  if (retrySeconds == null && error?.response?.headers?.get) {
    const retryAfterHeader = error.response.headers.get('retry-after');
    if (retryAfterHeader) {
      const parsed = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsed)) retrySeconds = parsed;
    }
  }

  if (retrySeconds == null) {
    const secMatch =
      message.match(/retry\s+(?:after|in)\s+(\d+)\s*s/i) ||
      message.match(/retryDelay"?\s*:\s*"?(\d+)s?/i) ||
      message.match(/after\s+(\d+)\s+seconds/i);
    if (secMatch) {
      retrySeconds = parseInt(secMatch[1], 10);
    } else {
      const dateMatch = message.match(/retry\s+after\s+(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/i);
      if (dateMatch) {
        const diff = Math.ceil((Date.parse(dateMatch[1]) - Date.now()) / 1000);
        if (diff > 0) retrySeconds = diff;
      }
    }
  }

  if (retrySeconds == null) {
    retrySeconds = isDaily ? 3600 * 4 : 60;
  }

  let quotaType = 'RPM';
  let quotaTypeLabel = 'Limite de requêtes par minute (15 RPM)';
  if (isDaily) {
    quotaType = 'RPD';
    quotaTypeLabel = 'Limite journalière de requêtes';
  } else if (isTokenLimit) {
    quotaType = 'TPM';
    quotaTypeLabel = 'Limite de volume de texte (tokens) par minute';
  }

  return {
    isQuota: true,
    isDaily,
    isTokenLimit,
    quotaType,
    quotaTypeLabel,
    retrySeconds: Math.max(1, retrySeconds),
    rawMessage: message,
  };
}

export function formatGeminiError(error, quotaInfo = null) {
  const message = extractCleanErrorMessage(error);
  if (/API_KEY_INVALID|INVALID_ARGUMENT|API key not valid/i.test(message)) {
    return 'Clé API Gemini invalide. Vérifiez que la clé commence par "AIzaSy..." et qu’elle est bien activée.';
  }
  const resolvedQuota = quotaInfo || parseGeminiQuotaError(error);
  if (resolvedQuota) {
    if (resolvedQuota.isDaily) {
      return 'Quota journalier Gemini atteint pour aujourd’hui. Google réinitialise ce quota chaque jour à minuit (UTC).';
    }
    if (resolvedQuota.isTokenLimit) {
      return 'Limite de volume de texte (tokens) atteinte pour cette minute. Réessayez dans un instant avec une question plus courte.';
    }
    const delay = resolvedQuota.retrySeconds;
    if (delay && delay > 0) {
      return `Limite de requêtes atteinte (quota Gemini). Réessai possible dans ${delay} seconde${delay > 1 ? 's' : ''}.`;
    }
    return 'Limite de requêtes atteinte (quota Gemini). Réessayez dans quelques instants.';
  }
  if (/Failed to fetch|NetworkError|offline/i.test(message)) {
    return 'Impossible de contacter les serveurs Google. Vérifiez votre connexion internet.';
  }
  if (/not found|is no longer available|model.*not found/i.test(message)) {
    return `Modèle Gemini indisponible : ${message}`;
  }
  return `Erreur Gemini : ${message}`;
}

async function getGenAI(apiKey) {
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey });
}

export async function validateGeminiApiKey(key) {
  const cleanKey = (key || '').trim();
  if (!cleanKey) {
    return { valid: false, error: 'Veuillez saisir une clé API Gemini.' };
  }

  try {
    const ai = await getGenAI(cleanKey);
    await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: 'Test rapide de validation.',
      ...(GEMINI_MODEL.startsWith('gemini-3') ? { config: { thinkingConfig: { thinkingLevel: 'low' } } } : {}),
    });
    recordGeminiRequest();
    return { valid: true };
  } catch (error) {
    const quota = parseGeminiQuotaError(error);
    if (quota) {
      recordQuotaExceeded(quota.retrySeconds);
      return {
        valid: false,
        error: formatGeminiError(error, quota),
        quotaInfo: quota,
      };
    }
    return { valid: false, error: formatGeminiError(error) };
  }
}

export const HOMEWORK_PROMPT_TYPES = {
  explain: {
    id: 'explain',
    label: '💡 M’expliquer la consigne',
    description: 'Reformule ce qui est demandé et explique les notions clés.',
  },
  theme: {
    id: 'theme',
    label: '📖 Thème & Leçon',
    description: 'Explique le thème du cours, le fil conducteur et les notions clés à travers les séances.',
  },
  method: {
    id: 'method',
    label: '📋 Méthode pas à pas',
    description: 'Donne une démarche et les étapes pour réussir sans faire le devoir à ma place.',
  },
  quiz: {
    id: 'quiz',
    label: '❓ Quiz d’entraînement',
    description: 'Propose 3 questions courtes pour tester ma compréhension.',
  },
  custom: {
    id: 'custom',
    label: '💬 Poser une question',
    description: 'Pose ta propre question sur ce travail.',
  },
};

export function buildHomeworkPrompt({
  subject = '',
  assignmentHtml = '',
  sessionHtml = '',
  timeline = [],
  promptType = 'explain',
  customPrompt = '',
}) {
  const cleanAssignment = stripHtml(assignmentHtml).slice(0, 1500);
  const cleanSession = stripHtml(sessionHtml).slice(0, 1500);

  let timelineText = '';
  if (Array.isArray(timeline) && timeline.length > 0) {
    const entries = timeline.slice(-8).map((item) => {
      const parts = [];
      parts.push(`- Séance du ${item.date || 'date inconnue'}`);
      if (item.interrogation) parts.push('  [Évaluation / Contrôle]');
      const session = stripHtml(item.contenuDeSeanceHtml);
      if (session) {
        const shortSession = session.length > 350 ? `${session.slice(0, 350)}…` : session;
        parts.push(`  Contenu de séance (cours) : ${shortSession}`);
      }
      const af = stripHtml(item.aFaireHtml);
      if (af) {
        const shortAf = af.length > 250 ? `${af.slice(0, 250)}…` : af;
        parts.push(`  Travail donné : ${shortAf}`);
      }
      return parts.join('\n');
    }).join('\n\n');

    timelineText = `\nHistorique récent des séances et devoirs dans cette matière (${timeline.length} séance${timeline.length > 1 ? 's' : ''}) :\n${entries}\n`;
  }

  let context = `Matière : ${subject || 'Non spécifiée'}\n`;
  if (cleanAssignment) {
    context += `Consigne du devoir : ${cleanAssignment}\n`;
  }
  if (cleanSession) {
    context += `Contenu de séance / cours lié : ${cleanSession}\n`;
  }
  if (timelineText) {
    context += timelineText;
  }

  let requestText = '';
  switch (promptType) {
    case 'explain':
      requestText =
        'Explique-moi simplement cette consigne de devoir. ' +
        'Quels sont les objectifs demandés ? Quels points importants ou pièges dois-je surveiller ?';
      break;
    case 'theme':
      requestText =
        'Analyse la série de devoirs et de séances récents pour cette matière et explique-moi le thème général du cours ou du chapitre actuel.\n' +
        '- Quel est le thème principal et le fil conducteur entre ces séances ?\n' +
        '- Quelles sont les notions clés, règles, formules ou définitions incontournables à retenir ?\n' +
        '- Donne une synthèse claire, structurée et pédagogique pour bien comprendre la leçon dans son ensemble.';
      break;
    case 'method':
      requestText =
        'Donne-moi une méthode de travail claire et des étapes numérotées pour faire ce devoir par moi-même. ' +
        'Ne me donne pas les réponses finales, mais guide ma démarche pas à pas.';
      break;
    case 'quiz':
      requestText =
        'Pour m’aider à préparer ce devoir et tester mes acquis, propose-moi un mini-quiz d’entraînement de 3 questions ' +
        'qui vérifie si j’ai bien compris les notions nécessaires.\n' +
        'CONSIGNE D’AFFICHAGE DYNAMIQUE (TRÈS IMPORTANT) :\n' +
        'Ne donne pas les corrections immédiatement visibles ! Pour chaque question, masque les indices et la correction dans une balise déroulante repliée par défaut, avec exactement ce format :\n' +
        '<details>\n' +
        '<summary>💡 Voir l’indice / la réponse</summary>\n\n' +
        '* **Indice :** [Indice pour m’aider]\n' +
        '* **Correction :** [Réponse et explication détaillée]\n' +
        '</details>\n' +
        'Cela me permet de chercher les réponses par moi-même avant de déplier le volet pour vérifier.';
      break;
    case 'custom':
    default:
      requestText = customPrompt?.trim()
        ? `Voici ma question concernant ce devoir : "${customPrompt.trim()}". Aide-moi à y répondre.`
        : 'Aide-moi à comprendre et réussir ce travail.';
      break;
  }

  return `${context}\nDemande de l'élève :\n${requestText}`;
}

export function buildChatContents({
  subject,
  assignmentHtml,
  sessionHtml,
  timeline,
  promptType,
  customPrompt,
  history = [],
  newMessage,
}) {
  const contents = [];

  // Le premier tour utilisateur contient le devoir et la consigne initiale
  const firstUserPrompt = buildHomeworkPrompt({
    subject,
    assignmentHtml,
    sessionHtml,
    timeline,
    promptType,
    customPrompt,
  });

  contents.push({
    role: 'user',
    parts: [{ text: firstUserPrompt }],
  });

  // Si l'historique commence par un message utilisateur (redondant avec firstUserPrompt), on l'ignore
  const historyToProcess =
    Array.isArray(history) && history.length > 0 && history[0].role === 'user'
      ? history.slice(1)
      : history;

  if (Array.isArray(historyToProcess) && historyToProcess.length > 0) {
    for (const msg of historyToProcess) {
      if (!msg?.text?.trim()) continue;
      const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: msg.text.trim() }],
      });
    }
  }

  if (newMessage && typeof newMessage === 'string' && newMessage.trim()) {
    contents.push({
      role: 'user',
      parts: [{ text: newMessage.trim() }],
    });
  }

  // Fusionner les tours consécutifs ayant le même rôle pour garantir l'alternance user <-> model
  const sanitized = [];
  for (const item of contents) {
    if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === item.role) {
      sanitized[sanitized.length - 1].parts[0].text += `\n\n${item.parts[0].text}`;
    } else {
      sanitized.push(item);
    }
  }

  return sanitized;
}

export async function askHomeworkAssistant({
  apiKey,
  subject,
  assignmentHtml,
  sessionHtml,
  timeline,
  promptType,
  customPrompt,
  history = [],
  newMessage,
  onChunk,
}) {
  const activeKey = (apiKey || getGeminiApiKey()).trim();
  if (!activeKey) {
    throw new Error('Aucune clé API Gemini n’est configurée. Veuillez renseigner votre clé dans les paramètres.');
  }

  // Vérifier si un verrou de quota est déjà actif
  const lockInfo = getQuotaUnlockInfo();
  if (lockInfo.isLocked) {
    const err = new Error(
      `Limite de requêtes atteinte (quota Gemini). Réessai possible dans ${lockInfo.secondsRemaining} seconde${lockInfo.secondsRemaining > 1 ? 's' : ''}.`,
    );
    err.quotaInfo = {
      isQuota: true,
      retrySeconds: lockInfo.secondsRemaining,
      unlockAt: lockInfo.unlockAt,
    };
    throw err;
  }

  const contents = buildChatContents({
    subject,
    assignmentHtml,
    sessionHtml,
    timeline,
    promptType,
    customPrompt,
    history,
    newMessage,
  });

  const ai = await getGenAI(activeKey);

  const candidateModels = CANDIDATE_MODELS.filter(
    (m, idx, arr) => arr.indexOf(m) === idx,
  );

  let lastError = null;
  let lastQuotaError = null;

  for (const modelToTry of candidateModels) {
    try {
      const config = {
        systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        ...(modelToTry.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
      };

      if (typeof onChunk === 'function') {
        const responseStream = await ai.models.generateContentStream({
          model: modelToTry,
          contents,
          config,
        });

        let fullText = '';
        let recorded = false;
        for await (const chunk of responseStream) {
          if (!recorded) {
            recordGeminiRequest();
            recorded = true;
          }
          const text = chunk.text || '';
          fullText += text;
          onChunk(fullText, text);
        }
        return fullText;
      }

      const response = await ai.models.generateContent({
        model: modelToTry,
        contents,
        config,
      });
      const text = response.text || '';
      recordGeminiRequest();
      return text;
    } catch (err) {
      console.warn(`Appel Gemini (${modelToTry}) a échoué :`, err);
      lastError = err;
      const quota = parseGeminiQuotaError(err);
      if (quota) {
        lastQuotaError = { err, quota };
      }
      const cleanMsg = extractCleanErrorMessage(err);
      // Si la clé est totalement invalide ou si c'est un quota journalier global, ne pas retenter
      if (quota?.isDaily || /API_KEY_INVALID/i.test(cleanMsg)) {
        break;
      }
    }
  }

  // Si tous les modèles candidats ont échoué, privilégier l'information de quota si elle a été rencontrée
  const effectiveError = lastQuotaError ? lastQuotaError.err : lastError;
  const quotaInfo = parseGeminiQuotaError(effectiveError);
  if (quotaInfo) {
    const unlockAt = recordQuotaExceeded(quotaInfo.retrySeconds);
    const formattedErr = new Error(formatGeminiError(effectiveError, quotaInfo));
    formattedErr.quotaInfo = {
      ...quotaInfo,
      unlockAt,
    };
    throw formattedErr;
  }
  throw new Error(formatGeminiError(effectiveError));
}
