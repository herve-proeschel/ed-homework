import { useState } from 'react';
import { decodeBase64Utf8 } from '../services/edClient';

function formatMessageDate(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSenderName(message) {
  const from = message.from;
  if (typeof from === 'string') return from;
  return from?.name || [from?.prenom, from?.nom].filter(Boolean).join(' ') || 'Expéditeur inconnu';
}

export default function MessagesView({ messages, onLoadMessage }) {
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});

  if (!messages) return null;
  if (messages.length === 0) {
    return <div id="messagesView"><p className="messages-empty">Aucun message reçu.</p></div>;
  }

  const toggleMessage = async (message) => {
    if (expandedId === message.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(message.id);
    if (details[message.id] && !details[message.id].error) return;

    setDetails((previous) => ({ ...previous, [message.id]: { loading: true } }));
    try {
      const data = await onLoadMessage(message.id);
      if (!data) return;
      setDetails((previous) => ({ ...previous, [message.id]: { data } }));
    } catch (error) {
      setDetails((previous) => ({ ...previous, [message.id]: { error: error.message } }));
    }
  };

  return (
    <div id="messagesView">
      {messages.map((message) => {
        const isExpanded = expandedId === message.id;
        const detail = details[message.id];
        const files = detail?.data?.files || message.files || [];
        const bodyHtml = decodeBase64Utf8(detail?.data?.content ?? '');
        return (
          <div className={`message-card${isExpanded ? ' message-card--open' : ''}${message.read === false ? ' message-card--unread' : ''}`} key={message.id}>
            <button
              type="button"
              className="message-header"
              onClick={() => toggleMessage(message)}
              aria-expanded={isExpanded}
            >
              <span className="message-subject">{message.subject || '(Sans objet)'}</span>
              <span className="message-meta">
                <span>{getSenderName(message)}</span>
                <span>{formatMessageDate(message.date)}</span>
              </span>
            </button>
            {isExpanded && (
              <div className="message-body">
                {detail?.loading && <p className="messages-empty">Chargement du message...</p>}
                {detail?.error && <p className="messages-empty">Erreur : {detail.error}</p>}
                {detail?.data && (
                  bodyHtml
                    // eslint-disable-next-line react/no-danger -- rich text markup from API data, not user input
                    ? <div className="subject-content" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                    : <em>Message vide</em>
                )}
                {detail?.data && files.length > 0 && (
                  <>
                    <h4 className="subject-documents-title">Pièces jointes</h4>
                    <ul className="subject-documents">
                      {files.map((file) => <li key={file.id || file.libelle}>{file.libelle || file.name}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
