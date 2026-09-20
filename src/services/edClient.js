const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL;
const ED_VERSION = '4.102.0';

export function decodeBase64Utf8(str) {
  if (!str) return '';
  try {
    const binary = atob(str);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    try {
      return atob(str);
    } catch {
      return str;
    }
  }
}

export function formatDateFrench(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// response.json() ne peut être lu qu'une fois et échoue si le flux est vide/incomplet
async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    console.error('Réponse non-JSON reçue :', text);
    return null;
  }
}

export function isSessionExpiredError(res) {
  if (!res) return false;
  const code = Number(res.code);
  if ([401, 403, 505, 520, 525].includes(code)) {
    return true;
  }
  if (typeof res.message === 'string') {
    const msg = res.message.toLowerCase();
    if (
      msg.includes('session expir') ||
      msg.includes('token invalide') ||
      msg.includes('token expiré') ||
      msg.includes('non authentifié') ||
      msg.includes('veuillez vous reconnecter') ||
      msg.includes('session fermée') ||
      msg.includes('inactivité')
    ) {
      return true;
    }
  }
  return false;
}

// Encapsule l'état de session ÉcoleDirecte (token/GTK/cookies) hors de React
export class EdClient {
  constructor() {
    this.activeToken = '';
    this.twoFaToken = '';
    this.savedGtk = '';
    this.rawCookies = '';
  }

  getState() {
    return {
      activeToken: this.activeToken,
      twoFaToken: this.twoFaToken,
      savedGtk: this.savedGtk,
      rawCookies: this.rawCookies,
    };
  }

  restoreState({ activeToken, twoFaToken, savedGtk, rawCookies }) {
    this.activeToken = activeToken || '';
    this.twoFaToken = twoFaToken || '';
    this.savedGtk = savedGtk || '';
    this.rawCookies = rawCookies || '';
  }

  async apiCall(endpoint, method = 'POST', payload = {}, withToken = true) {
    if (!PROXY_BASE_URL) {
      throw new Error('VITE_PROXY_BASE_URL est obligatoire pour contacter le proxy');
    }

    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    const separator = cleanEndpoint.includes('?') ? '&' : '?';
    const endpointWithVersion = cleanEndpoint.includes('v=')
      ? cleanEndpoint
      : `${cleanEndpoint}${separator}v=${ED_VERSION}`;
    const url = `${PROXY_BASE_URL}/${endpointWithVersion}`;

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json, text/plain, */*',
    };

    if (withToken && this.activeToken) {
      headers['X-Token'] = this.activeToken;
    }
    if (this.savedGtk) {
      headers['x-gtk'] = this.savedGtk;
    }
    if (this.rawCookies) {
      headers['x-cookies'] = this.rawCookies;
    }
    if (cleanEndpoint.includes('/doubleauth.awp') && this.twoFaToken) {
      headers['2fa-token'] = this.twoFaToken;
    }

    const bodyParam = new URLSearchParams();
    bodyParam.append('data', JSON.stringify(payload));

    const response = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? bodyParam.toString() : undefined,
    });

    const refreshedToken = response.headers.get('x-token') || response.headers.get('X-Token');
    if (refreshedToken) {
      this.activeToken = refreshedToken;
    }

    const twoFaToken = response.headers.get('2fa-token') || response.headers.get('x-2fa-token');
    if (twoFaToken) {
      this.twoFaToken = twoFaToken;
    }

    const newCookies = response.headers.get('x-all-cookies');
    if (newCookies) {
      this.rawCookies = newCookies;
      const gtkMatch = newCookies.match(/GTK=([^;]+)/);
      if (gtkMatch && gtkMatch[1]) {
        this.savedGtk = gtkMatch[1];
      }
    }

    const jsonResponse = await parseJsonResponse(response);
    if (!jsonResponse) {
      return { code: response.status, message: response.statusText || 'Erreur réseau/serveur' };
    }
    return jsonResponse;
  }

  async initGtk() {
    if (!PROXY_BASE_URL) {
      throw new Error('VITE_PROXY_BASE_URL est obligatoire pour contacter le proxy');
    }

    this.activeToken = '';
    this.twoFaToken = '';
    this.savedGtk = '';
    this.rawCookies = '';

    const gtkUrl = `${PROXY_BASE_URL}/v3/login.awp?gtk=1&v=${ED_VERSION}`;
    const gtkRes = await fetch(gtkUrl, {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain, */*' },
    });

    const returnedCookies = gtkRes.headers.get('x-all-cookies') || '';
    if (returnedCookies) {
      this.rawCookies = returnedCookies;
      const match = returnedCookies.match(/GTK=([^;]+)/);
      if (match && match[1]) {
        this.savedGtk = match[1];
      }
    }

    const gtkJson = await parseJsonResponse(gtkRes);
    if (gtkJson && gtkJson.data && gtkJson.data.token) {
      this.savedGtk = gtkJson.data.token;
    }
  }

  async login(username, password, fa) {
    const loginPayload = {
      identifiant: username.trim(),
      motdepasse: password,
      isReLogin: false,
      uuid: '',
      fa: fa || [],
    };
    const res = await this.apiCall('v3/login.awp', 'POST', loginPayload, false);
    if (res.code === 200 && res.token) {
      this.activeToken = res.token;
    }
    return res;
  }

  async getQcm() {
    return this.apiCall('v3/connexion/doubleauth.awp?verbe=get', 'POST', {}, false);
  }

  async answerQcm(choice) {
    const response = await this.apiCall(
      'v3/connexion/doubleauth.awp?verbe=post',
      'POST',
      { choix: choice },
      false,
    );
    this.twoFaToken = '';
    return response;
  }

  async getCahierDeTexte(eleveId) {
    return this.apiCall(`v3/Eleves/${eleveId}/cahierdetexte.awp?verbe=get`);
  }

  async getCahierDeTexteDetail(eleveId, date) {
    return this.apiCall(`v3/Eleves/${eleveId}/cahierdetexte/${date}.awp?verbe=get`);
  }
}

export function getAccountFullName(data) {
  const account = data && data.accounts && data.accounts[0];
  if (!account) return '';
  return `${account.prenom || ''} ${account.nom || ''}`.trim();
}

export function getEleveAccounts(data) {
  if (!data || !data.accounts) return [];
  const fromProfiles = data.accounts.flatMap((a) => (a.profile && a.profile.eleves) || []);
  return fromProfiles;
}

export function getElevePhotoSrc(eleve) {
  const photo = (eleve.profile && eleve.profile.photo) || eleve.photo || '';
  if (!photo) return '';
  if (photo.startsWith('//')) return `https:${photo}`;
  if (photo.startsWith('http') || photo.startsWith('data:')) return photo;
  return `data:image/jpeg;base64,${photo}`;
}
