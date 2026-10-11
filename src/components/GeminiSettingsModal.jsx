import { useState } from 'react';
import {
  clearGeminiApiKey,
  clearGeminiUsage,
  formatTimeDisplay,
  getGeminiApiKey,
  getGeminiUsageStats,
  maskGeminiApiKey,
  saveGeminiApiKey,
  validateGeminiApiKey,
} from '../services/geminiClient';

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function GeminiSettingsModalDialog({ onClose, onKeyChange }) {
  const [storedKey, setStoredKey] = useState(getGeminiApiKey);
  const [apiKey, setApiKey] = useState(getGeminiApiKey);
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isError, setIsError] = useState(false);
  const [usageStats, setUsageStats] = useState(getGeminiUsageStats);

  const handlePaste = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) setApiKey(text.trim());
      }
    } catch {
      // ignore clipboard permission error
    }
  };

  const handleSaveAndTest = async () => {
    const keyToTest = apiKey.trim();
    if (!keyToTest) {
      setIsError(true);
      setStatusMessage('Veuillez renseigner votre clé API Gemini.');
      return;
    }

    setBusy(true);
    setStatusMessage('Validation de la clé en cours auprès de Google...');
    setIsError(false);

    const result = await validateGeminiApiKey(keyToTest);
    setBusy(false);
    setUsageStats(getGeminiUsageStats());

    if (result.valid) {
      saveGeminiApiKey(keyToTest);
      setStoredKey(keyToTest);
      setIsError(false);
      setStatusMessage('✓ Clé Gemini valide et enregistrée avec succès !');
      onKeyChange?.(keyToTest);
    } else {
      setIsError(true);
      setStatusMessage(result.error);
    }
  };

  const handleRemoveKey = () => {
    clearGeminiApiKey();
    setStoredKey('');
    setApiKey('');
    setStatusMessage('Clé API supprimée de cet appareil.');
    setIsError(false);
    setUsageStats(getGeminiUsageStats());
    onKeyChange?.('');
  };

  return (
    <div
      className="gemini-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="gemini-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gemini-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="gemini-modal-header">
          <h2 id="gemini-modal-title" className="gemini-modal-title">
            <span>✨</span> Assistant IA (Gemini)
          </h2>
          <button
            type="button"
            className="gemini-modal-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="gemini-modal-body">
          <p className="gemini-desc">
            Connectez votre compte <strong>Google Gemini</strong> pour activer l’aide aux devoirs personnalisée (explications claires, méthodes pas à pas, quiz d’entraînement).
            L’accès personnel est <strong>100 % gratuit</strong> via Google AI Studio.
          </p>

          <div className="gemini-guide-step">
            <div className="gemini-step-header">
              <span className="gemini-step-badge">1</span>
              <span>Obtenir votre clé API personnelle</span>
            </div>
            <p className="gemini-desc" style={{ margin: 0 }}>
              Créez une clé d’API gratuite en vous connectant avec votre compte Google :
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="gemini-external-link"
            >
              <span>Ouvrir Google AI Studio</span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="gemini-guide-step">
            <div className="gemini-step-header">
              <span className="gemini-step-badge">2</span>
              <span>Coller votre clé API</span>
            </div>
            <div className="gemini-input-wrapper">
              <input
                id="gemini-key-input"
                type={showKey ? 'text' : 'password'}
                className="gemini-key-input"
                placeholder="Exemple : AIzaSy..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              <div className="gemini-input-actions">
                <button
                  type="button"
                  className="gemini-icon-btn"
                  onClick={handlePaste}
                  title="Coller depuis le presse-papiers"
                  aria-label="Coller depuis le presse-papiers"
                >
                  <PasteIcon />
                </button>
                <button
                  type="button"
                  className="gemini-icon-btn"
                  onClick={() => setShowKey((prev) => !prev)}
                  title={showKey ? 'Masquer la clé' : 'Afficher la clé'}
                  aria-label={showKey ? 'Masquer la clé' : 'Afficher la clé'}
                >
                  <EyeIcon visible={showKey} />
                </button>
              </div>
            </div>
          </div>

          {storedKey && (
            <div className="gemini-status-card">
              <span className="gemini-status-pill is-active">
                🟢 Clé connectée : {maskGeminiApiKey(storedKey)}
              </span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="secondary-btn"
                  style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem' }}
                  onClick={handleSaveAndTest}
                  disabled={busy}
                >
                  Tester à nouveau
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem', color: 'var(--error)' }}
                  onClick={handleRemoveKey}
                  disabled={busy}
                >
                  Supprimer la clé
                </button>
              </div>
            </div>
          )}

          {storedKey && (
            <div className="gemini-usage-stats-card">
              <div className="gemini-step-header">
                <span style={{ fontSize: '1.1rem' }}>📊</span>
                <span style={{ fontWeight: 600 }}>Statistiques d’utilisation</span>
              </div>
              <div className="gemini-quota-stats-grid">
                <div className="gemini-quota-stat-item">
                  <span className="gemini-quota-stat-label">Dernière minute</span>
                  <span className="gemini-quota-stat-value">
                    {usageStats.requestsLastMinute} / {usageStats.indicativeRpmLimit} req.
                  </span>
                </div>
                <div className="gemini-quota-stat-item">
                  <span className="gemini-quota-stat-label">Aujourd’hui</span>
                  <span className="gemini-quota-stat-value">
                    {usageStats.requestsToday} req.
                  </span>
                </div>
              </div>
              {usageStats.isQuotaLocked && (
                <div className="gemini-quota-timer" style={{ marginTop: '8px' }}>
                  <span>⏳ Quota temporairement atteint — Déblocage dans {usageStats.secondsRemaining}s (à {formatTimeDisplay(usageStats.unlockAt)})</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="secondary-btn"
                  style={{ height: '26px', padding: '0 8px', fontSize: '0.75rem' }}
                  onClick={() => {
                    clearGeminiUsage();
                    setUsageStats(getGeminiUsageStats());
                  }}
                >
                  Effacer l’historique d’usage
                </button>
              </div>
            </div>
          )}

          {statusMessage && (
            <div className={`gemini-alert ${isError ? 'is-error' : 'is-success'}`} role="status">
              {statusMessage}
            </div>
          )}

          <div className="gemini-privacy-box">
            <span style={{ fontSize: '1.1rem' }}>🛡️</span>
            <span>
              <strong>Confidentialité garantie :</strong> Votre clé est stockée uniquement sur cet appareil (dans votre navigateur). Vos devoirs et questions sont transmis directement aux serveurs sécurisés de Google, sans passer par aucun intermédiaire.
            </span>
          </div>
        </div>

        <div className="gemini-modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Fermer
          </button>
          <button
            type="button"
            className="main-btn"
            style={{ minWidth: '140px' }}
            onClick={handleSaveAndTest}
            disabled={busy || !apiKey.trim()}
          >
            {busy ? 'Test en cours...' : 'Enregistrer et tester'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GeminiSettingsModal({ isOpen, onClose, onKeyChange }) {
  if (!isOpen) return null;
  return <GeminiSettingsModalDialog onClose={onClose} onKeyChange={onKeyChange} />;
}

