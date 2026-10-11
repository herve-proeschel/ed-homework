import { useEffect, useRef, useState } from 'react';
import {
  HOMEWORK_PROMPT_TYPES,
  askHomeworkAssistant,
  clearGeminiUsage,
  clearQuotaLock,
  formatTimeDisplay,
  getGeminiApiKey,
  getGeminiUsageStats,
  getQuotaUnlockInfo,
} from '../services/geminiClient';
import { formatAiText } from '../utils/formatAiText';

function AutoAwesomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

function HomeworkAiModalDialog({
  homework,
  onClose,
  onOpenSettings,
}) {
  const initialTab = homework.defaultTab || (homework.timeline?.length > 0 && !homework.aFaireHtml ? 'theme' : 'explain');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [customPrompt, setCustomPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [replyInput, setReplyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [quotaInfo, setQuotaInfo] = useState(() => {
    const lock = getQuotaUnlockInfo();
    return lock.isLocked ? lock : null;
  });
  const [usageStats, setUsageStats] = useState(getGeminiUsageStats);

  const messagesEndRef = useRef(null);
  const replyInputRef = useRef(null);

  const hasApiKey = Boolean(getGeminiApiKey());

  const subject = homework.matiere || 'Matière';
  const assignmentHtml = homework.aFaireHtml || '';
  const sessionHtml = homework.contenuDeSeanceHtml || '';
  const timeline = homework.timeline || [];

  const handleAsk = async (promptType = activeTab, promptText = customPrompt) => {
    if (!hasApiKey) {
      onOpenSettings?.();
      return;
    }

    setBusy(true);
    setError(null);
    setCopiedId(null);

    const assistantMsgId = Date.now();
    const initialList = promptType === 'custom' && promptText
      ? [
          { id: assistantMsgId - 1, role: 'user', text: promptText },
          { id: assistantMsgId, role: 'assistant', text: '' },
        ]
      : [{ id: assistantMsgId, role: 'assistant', text: '' }];

    setMessages(initialList);

    try {
      await askHomeworkAssistant({
        subject,
        assignmentHtml,
        sessionHtml,
        timeline,
        promptType,
        customPrompt: promptText,
        onChunk: (fullText) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, text: fullText } : msg)),
          );
        },
      });
      setQuotaInfo(null);
      setUsageStats(getGeminiUsageStats());
    } catch (err) {
      setError(err?.message || 'Une erreur est survenue lors de la communication avec Gemini.');
      if (err?.quotaInfo) {
        setQuotaInfo(err.quotaInfo);
      }
      setUsageStats(getGeminiUsageStats());
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMsgId || msg.text));
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async (textToSend = replyInput) => {
    const cleanText = (textToSend || '').trim();
    if (!cleanText || busy) return;

    if (!hasApiKey) {
      onOpenSettings?.();
      return;
    }

    setBusy(true);
    setError(null);
    setReplyInput('');

    const userMsgId = Date.now();
    const assistantMsgId = userMsgId + 1;

    // Capture de l'historique complet pour alterner les tours avec Gemini
    const historySnapshot = messages
      .filter((m) => m.text)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', text: cleanText },
      { id: assistantMsgId, role: 'assistant', text: '' },
    ]);

    try {
      await askHomeworkAssistant({
        subject,
        assignmentHtml,
        sessionHtml,
        timeline,
        promptType: activeTab,
        customPrompt,
        history: historySnapshot,
        newMessage: cleanText,
        onChunk: (fullText) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, text: fullText } : msg)),
          );
        },
      });
      setQuotaInfo(null);
      setUsageStats(getGeminiUsageStats());
    } catch (err) {
      setError(err?.message || 'Une erreur est survenue lors de la communication avec Gemini.');
      if (err?.quotaInfo) {
        setQuotaInfo(err.quotaInfo);
      }
      setUsageStats(getGeminiUsageStats());
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMsgId || msg.text));
      setReplyInput(cleanText);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!quotaInfo?.unlockAt) return undefined;

    const tick = () => {
      const diffMs = quotaInfo.unlockAt - Date.now();
      const left = Math.max(0, Math.ceil(diffMs / 1000));
      if (left <= 0) {
        setQuotaInfo((prev) => (prev ? { ...prev, secondsRemaining: 0, canRetry: true } : null));
        clearQuotaLock();
        setUsageStats(getGeminiUsageStats());
      } else {
        setQuotaInfo((prev) => (prev ? { ...prev, secondsRemaining: left } : null));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [quotaInfo?.unlockAt]);

  useEffect(() => {
    if (hasApiKey && initialTab !== 'custom') {
      handleAsk(initialTab, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, busy]);

  const handleSelectTab = (tabId) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    setMessages([]);
    setError(null);
    setQuotaInfo(null);
    if (tabId !== 'custom') {
      handleAsk(tabId, '');
    }
  };

  const handleCopy = async (id, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const quickChips = activeTab === 'quiz'
    ? [
        { label: '🎯 Tout juste (3/3) !', text: 'J’ai eu 3/3 au quiz, tout est parfaitement clair pour moi !' },
        { label: '❓ Question 1 non comprise', text: 'Je n’ai pas bien compris la question 1, peux-tu me la réexpliquer pas à pas ?' },
        { label: '❓ Question 2 non comprise', text: 'Je n’ai pas bien compris la question 2, peux-tu me la réexpliquer pas à pas ?' },
        { label: '❓ Question 3 non comprise', text: 'Je n’ai pas bien compris la question 3, peux-tu me la réexpliquer pas à pas ?' },
        { label: '🔄 Autre question d’entraînement', text: 'Peux-tu me poser une autre question d’entraînement sur cette leçon ?' },
      ]
    : [
        { label: '💡 Donne-moi un exemple', text: 'Peux-tu me donner un exemple concret avec des étapes simples ?' },
        { label: '❓ Je bloque sur une étape', text: 'Je bloque sur cette consigne, peux-tu m’aider à démarrer sans me donner la solution ?' },
        { label: '✅ Vérifie ma méthode / mon calcul', text: 'Voici ce que j’ai trouvé pour cet exercice : [indique ici ta réponse ou ton calcul]. Est-ce correct ?' },
        { label: '📐 Rappelle-moi la règle / formule', text: 'Peux-tu me rappeler la règle ou la formule exacte à appliquer ?' },
      ];

  const handleChipClick = (chip) => {
    if (chip.text.includes('[')) {
      setReplyInput(chip.text);
      replyInputRef.current?.focus();
    } else {
      handleSendReply(chip.text);
    }
  };

  return (
    <div
      className="gemini-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className={`gemini-modal homework-ai-modal ${messages.length > 0 ? 'has-messages' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="homework-ai-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="gemini-modal-header">
          <h2 id="homework-ai-modal-title" className="gemini-modal-title">
            <span className="gemini-modal-title-icon" aria-hidden="true">
              <AutoAwesomeIcon />
            </span>
            <span>Aide aux devoirs • {subject}</span>
          </h2>
          <button
            type="button"
            className="gemini-modal-close"
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="gemini-modal-body">
          {!hasApiKey ? (
            <div className="gemini-status-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Pour poser des questions à Gemini et obtenir une explication sur ce devoir, veuillez d’abord connecter votre compte Gemini.
              </p>
              <button
                type="button"
                className="main-btn"
                style={{ width: 'auto', alignSelf: 'center', minWidth: '220px' }}
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
              >
                🔑 Connecter ma clé Gemini (100 % gratuit)
              </button>
            </div>
          ) : (
            <>
              {timeline.length > 1 && (
                <div className="homework-ai-timeline-badge">
                  <span>📚</span>
                  <span>{timeline.length} séances et devoirs récents analysés pour cette matière</span>
                </div>
              )}

              <div className="homework-ai-tabs" role="tablist" aria-label="Modes d'assistance">
                {Object.values(HOMEWORK_PROMPT_TYPES).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`homework-ai-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                    onClick={() => handleSelectTab(tab.id)}
                    disabled={busy}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'custom' && messages.length === 0 && (
                <div className="homework-ai-custom-input">
                  <textarea
                    className="homework-ai-textarea"
                    placeholder="Exemple : Peux-tu me rappeler la formule nécessaire ?"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (customPrompt.trim() && !busy) {
                          handleAsk('custom', customPrompt);
                        }
                      }
                    }}
                    rows={3}
                  />
                  <div className="homework-ai-reply-footer">
                    <span className="homework-ai-reply-hint">
                      Appuie sur Entrée pour envoyer • Maj + Entrée pour un saut de ligne
                    </span>
                    <button
                      type="button"
                      className="main-btn homework-ai-send-btn"
                      onClick={() => handleAsk('custom', customPrompt)}
                      disabled={busy || !customPrompt.trim()}
                    >
                      <SendIcon />
                      <span>Envoyer</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Discussion interactive / Fil de conversation Material Design */}
              {messages.length > 0 && (
                <div className="homework-ai-conversation" role="region" aria-label="Discussion avec le tuteur">
                  {messages.map((msg) => {
                    if (msg.role === 'user') {
                      return (
                        <div key={msg.id} className="homework-ai-msg is-user">
                          <div className="homework-ai-msg-header is-user">
                            <span className="homework-ai-avatar is-user" aria-hidden="true">
                              <PersonIcon />
                            </span>
                            <span className="homework-ai-msg-author is-user">Toi</span>
                          </div>
                          <div className="homework-ai-msg-bubble-user">{msg.text}</div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className="homework-ai-msg is-assistant">
                        <div className="homework-ai-msg-header">
                          <span className="homework-ai-avatar is-assistant" aria-hidden="true">
                            <AutoAwesomeIcon />
                          </span>
                          <span className="homework-ai-msg-author">Tuteur pédagogique</span>
                        </div>
                        {msg.text ? (
                          <div
                            className="homework-ai-response"
                            // eslint-disable-next-line react/no-danger -- rendered from sanitized markdown format
                            dangerouslySetInnerHTML={{ __html: formatAiText(msg.text) }}
                          />
                        ) : (
                          <div className="homework-ai-loading">
                            <div className="homework-ai-spinner" />
                            <span>Gemini prépare une explication adaptée...</span>
                          </div>
                        )}
                        {msg.text && (
                          <div className="homework-ai-msg-actions">
                            <button
                              type="button"
                              className="homework-ai-copy-btn"
                              onClick={() => handleCopy(msg.id, msg.text)}
                              aria-label="Copier la réponse dans le presse-papiers"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <CheckIcon />
                                  <span>Copié !</span>
                                </>
                              ) : (
                                <>
                                  <CopyIcon />
                                  <span>Copier</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {busy && messages.length === 0 && (
                <div className="homework-ai-loading">
                  <div className="homework-ai-spinner" />
                  <span>Gemini prépare une explication adaptée...</span>
                </div>
              )}

              {quotaInfo ? (
                <div className="gemini-quota-card" role="alert">
                  <div className="gemini-quota-header">
                    <span className="gemini-quota-icon">⏳</span>
                    <div>
                      <h4 className="gemini-quota-title">
                        {quotaInfo.isDaily
                          ? 'Quota journalier Google atteint'
                          : quotaInfo.isTokenLimit
                            ? 'Limite de tokens par minute atteinte'
                            : 'Limite de requêtes par minute atteinte'}
                      </h4>
                      <p className="gemini-quota-desc">
                        {quotaInfo.isDaily
                          ? 'Le plafond de requêtes par jour pour ce compte Google a été atteint. Ce quota se réinitialise à minuit (UTC).'
                          : quotaInfo.secondsRemaining > 0
                            ? 'La fréquence maximale autorisée par Google est temporairement atteinte. Déblocage automatique en cours.'
                            : 'Le délai d’attente est terminé ! Vous pouvez relancer votre demande.'}
                      </p>
                    </div>
                  </div>

                  <div className="gemini-quota-countdown-row">
                    {quotaInfo.isDaily ? (
                      <div className="gemini-quota-timer" style={{ color: '#d93025' }}>
                        <span>📅 Réinitialisation du quota journalier à minuit (UTC).</span>
                      </div>
                    ) : quotaInfo.secondsRemaining > 0 ? (
                      <div className="gemini-quota-timer">
                        <span>⏱️ Réessai disponible dans :</span>
                        <strong className="gemini-quota-timer-val">{quotaInfo.secondsRemaining}s</strong>
                        <span className="gemini-quota-timer-time">
                          (à {formatTimeDisplay(quotaInfo.unlockAt)})
                        </span>
                      </div>
                    ) : (
                      <div className="gemini-quota-timer is-ready">
                        <span>✓ Prêt ! Vous pouvez réessayer maintenant.</span>
                      </div>
                    )}

                    <button
                      type="button"
                      className="main-btn gemini-quota-retry-btn"
                      disabled={busy || (!quotaInfo.isDaily && quotaInfo.secondsRemaining > 0)}
                      onClick={() => {
                        clearQuotaLock();
                        setQuotaInfo(null);
                        setError(null);
                        const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                        if (lastUser?.text) {
                          handleSendReply(lastUser.text);
                        } else {
                          handleAsk(activeTab);
                        }
                      }}
                    >
                      {busy ? 'En cours...' : '🔄 Réessayer maintenant'}
                    </button>
                  </div>

                  {quotaInfo.rawMessage && (
                    <details className="gemini-quota-raw-details">
                      <summary>Détail technique renvoyé par Google</summary>
                      <pre className="gemini-quota-raw-pre">{quotaInfo.rawMessage}</pre>
                    </details>
                  )}

                  <div className="gemini-quota-stats">
                    <div className="gemini-quota-stats-header">
                      <span>📊 Statistiques d’usage de votre clé :</span>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <p className="gemini-quota-hint">
                        ℹ️ Sur le plan gratuit Google AI Studio, la limite standard est de 15 requêtes/min.
                      </p>
                      <button
                        type="button"
                        className="secondary-btn"
                        style={{ height: '24px', padding: '0 8px', fontSize: '0.7rem' }}
                        onClick={() => {
                          clearGeminiUsage();
                          setUsageStats(getGeminiUsageStats());
                        }}
                      >
                        Remettre à zéro les compteurs
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                error && (
                  <div className="gemini-alert is-error" role="alert">
                    {error}
                  </div>
                )
              )}

              {/* Barre de réponse interactive sous les messages */}
              {messages.length > 0 && (
                <div className="homework-ai-reply-bar">
                  <div className="homework-ai-quick-chips" aria-label="Suggestions de réponses">
                    {quickChips.map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="homework-ai-chip"
                        disabled={busy}
                        onClick={() => handleChipClick(chip)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <div className="homework-ai-reply-box">
                    <textarea
                      ref={replyInputRef}
                      className="homework-ai-reply-textarea"
                      placeholder="Écris ta réponse au tuteur ou pose une question supplémentaire..."
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      rows={2}
                      disabled={busy}
                    />
                    <div className="homework-ai-reply-footer">
                      <span className="homework-ai-reply-hint">
                        Appuie sur Entrée pour envoyer • Maj + Entrée pour un saut de ligne
                      </span>
                      <button
                        type="button"
                        className="main-btn homework-ai-send-btn"
                        onClick={() => handleSendReply()}
                        disabled={busy || !replyInput.trim()}
                      >
                        <SendIcon />
                        <span>{busy ? 'Envoi...' : 'Envoyer'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="gemini-modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomeworkAiModal({
  isOpen,
  onClose,
  homework,
  onOpenSettings,
}) {
  if (!isOpen || !homework) return null;
  return (
    <HomeworkAiModalDialog
      homework={homework}
      onClose={onClose}
      onOpenSettings={onOpenSettings}
    />
  );
}
