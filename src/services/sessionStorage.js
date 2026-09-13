const SESSION_KEY = 'ed_session';
const USER_KEY = 'ed_user';
const FA_KEY = 'ed_fa';

export function saveSession(state) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

export function restoreSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    if (!saved.activeToken || !saved.selectedEleveId) return null;
    return saved;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSavedUsername() {
  return localStorage.getItem(USER_KEY) || '';
}

export function saveUsername(username) {
  localStorage.setItem(USER_KEY, username);
}

export function getSavedFa() {
  return JSON.parse(localStorage.getItem(FA_KEY) || 'null');
}

export function saveFa(fa) {
  localStorage.setItem(FA_KEY, JSON.stringify(fa));
}
