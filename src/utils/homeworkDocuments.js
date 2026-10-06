const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL;
const DOCUMENT_ENDPOINT = 'v3/telechargement.awp';
const ED_VERSION = '4.103.0';

function normalizeDocumentId(documentId) {
  const value = String(documentId ?? '').trim();
  return /^\d+$/.test(value) ? value : '';
}

function getDocumentId(document) {
  return normalizeDocumentId(document?.id ?? document?.fichierId);
}

function getDocumentType(document) {
  const type = typeof document?.type === 'string' ? document.type.trim() : '';
  return type || 'FICHIER_CDT';
}

function normalizeDocuments(documents) {
  if (!Array.isArray(documents)) return [];

  const seen = new Set();
  return documents.filter((document) => {
    const id = getDocumentId(document);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function getHomeworkSession(subject) {
  const nestedSession = subject?.aFaire?.contenuDeSeance;
  const subjectSession = subject?.contenuDeSeance;
  if (!nestedSession && !subjectSession) return null;

  return {
    ...(subjectSession || {}),
    ...(nestedSession || {}),
    contenu: nestedSession?.contenu || subjectSession?.contenu || '',
    documents: [
      ...(Array.isArray(subjectSession?.documents) ? subjectSession.documents : []),
      ...(Array.isArray(nestedSession?.documents) ? nestedSession.documents : []),
    ],
  };
}

export function getHomeworkDocumentSections(subject) {
  const session = getHomeworkSession(subject);
  return {
    homework: normalizeDocuments(subject?.aFaire?.documents),
    session: normalizeDocuments(session?.documents),
  };
}

export function getHomeworkDocumentLabel(document) {
  return document?.libelle || document?.nom || document?.name || 'Document';
}

export function buildDocumentEndpoint(documentId, documentType = 'FICHIER_CDT') {
  const normalizedId = normalizeDocumentId(documentId);
  if (!normalizedId) return '';

  const params = new URLSearchParams({
    verbe: 'get',
    fichierId: normalizedId,
    leTypeDeFichier: documentType || 'FICHIER_CDT',
    v: ED_VERSION,
  });
  return `${DOCUMENT_ENDPOINT}?${params.toString()}`;
}

export function getHomeworkDocumentUrl(document) {
  const endpoint = buildDocumentEndpoint(getDocumentId(document), getDocumentType(document));
  if (!endpoint || !PROXY_BASE_URL) return '';
  return `${PROXY_BASE_URL.replace(/\/+$/, '')}/${endpoint}`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
