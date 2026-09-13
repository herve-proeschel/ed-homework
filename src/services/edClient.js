const PROXY_BASE_URL = 'https://ed-cors-proxy.herve-proeschel.workers.dev';
const ED_VERSION = '4.101.4';

export function decodeBase64Utf8(str) {
  if (!str) return '';
  try {
    const binary = atob(str);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    try {
      return atob(str);
    } catch (err) {
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
  } catch (e) {
    console.error('Réponse non-JSON reçue :', text);
    return null;
  }
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
    return jsonResponse || {};
  }

  async initGtk() {
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

export function getEleveAccounts(data) {
  if (!data || !data.accounts) return [];
  const directEleves = data.accounts.filter((a) => a.isELE === true);
  if (directEleves.length > 0) return directEleves;
  const fromProfiles = data.accounts.flatMap((a) => (a.profile && a.profile.eleves) || []);
  if (fromProfiles.length > 0) return fromProfiles;
  const eleves = data.accounts.filter((a) => a.typeCompte === 'E');
  return eleves.length > 0 ? eleves : data.accounts;
}

export function getElevePhotoSrc(eleve) {
  const photo = (eleve.profile && eleve.profile.photo) || eleve.photo || '';
  if (!photo) return '';
  if (photo.startsWith('//')) return `https:${photo}`;
  if (photo.startsWith('http') || photo.startsWith('data:')) return photo;
  return `data:image/jpeg;base64,${photo}`;
}
