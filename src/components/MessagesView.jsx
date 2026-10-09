import { useState } from 'react';
import { decodeBase64Utf8 } from '../services/edClient';
import {
  getHomeworkDocumentFilename,
  getHomeworkDocumentLabel,
  getHomeworkDocumentUrl,
} from '../utils/homeworkDocuments';

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

const PAPERCLIP_PATH = 'M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5z';

function getInitial(name) {
  return (name.match(/\p{L}/u)?.[0] || '?').toUpperCase();
}

export default function MessagesView({ messages, onLoadMessage, onOpenDocument }) {
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
    <ul id="messagesView" aria-label="Messages reçus">
      {messages.map((message) => {
        const isExpanded = expandedId === message.id;
        const isUnread = message.read === false;
        const detail = details[message.id];
        const files = detail?.data?.files || message.files || [];
        const sender = getSenderName(message);
        const bodyHtml = decodeBase64Utf8(detail?.data?.content ?? '');
        return (
          <li className={`message-card${isExpanded ? ' message-card--open' : ''}${isUnread ? ' message-card--unread' : ''}`} key={message.id}>
            <button
              type="button"
              className="message-header"
              onClick={() => toggleMessage(message)}
              aria-expanded={isExpanded}
            >
              <span className="message-avatar" aria-hidden="true">{getInitial(sender)}</span>
              <span className="message-text">
                <span className="message-sender">{sender}</span>
                <span className="message-subject">{message.subject || '(Sans objet)'}</span>
                <span className="message-date">{formatMessageDate(message.date)}</span>
              </span>
              <span className="message-trailing" aria-hidden="true">
                {files.length > 0 && (
                  <svg className="message-attachment-icon" viewBox="0 0 24 24" focusable="false">
                    <path d={PAPERCLIP_PATH} />
                  </svg>
                )}
                <svg className="message-chevron" viewBox="0 0 24 24" focusable="false">
                  <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                </svg>
              </span>
              {files.length > 0 && <span className="visually-hidden">Pièce jointe</span>}
            </button>
            <div className="message-collapse" inert={!isExpanded} aria-hidden={!isExpanded}>
              <div className="message-collapse-inner">
                {detail && (
                  <div className="message-body">
                    {detail.loading && <p className="messages-empty">Chargement du message...</p>}
                    {detail.error && <p className="messages-empty">Erreur : {detail.error}</p>}
                    {detail.data && (
                      bodyHtml
                        // eslint-disable-next-line react/no-danger -- rich text markup from API data, not user input
                        ? <div className="message-content" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                        : <em>Message vide</em>
                    )}
                    {detail.data && files.length > 0 && (
                      <div className="message-attachments">
                        {files.map((file) => {
                          const url = getHomeworkDocumentUrl(file);
                          const label = getHomeworkDocumentLabel(file);
                          return (
                            <a
                              className="message-chip"
                              key={file.id || file.libelle}
                              href={url || undefined}
                              download={getHomeworkDocumentFilename(file)}
                              onClick={(event) => {
                                if (!onOpenDocument || !url) return;
                                event.preventDefault();
                                onOpenDocument(file);
                              }}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={PAPERCLIP_PATH} /></svg>
                              <span>{label}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}