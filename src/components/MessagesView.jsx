import { useEffect, useRef, useState } from 'react';
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

const SEARCH_DEBOUNCE_MS = 400;

export default function MessagesView({ messages, query = '', searchOpen = false, onCloseSearch, onSearch, onLoadMessage, onOpenDocument }) {
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});
  const [searchText, setSearchText] = useState(query);
  const inputRef = useRef(null);
  const toolbarRef = useRef(null);
  const lastSearchRef = useRef(query);

  useEffect(() => {
    if (searchText.trim() === lastSearchRef.current) return undefined;
    const timer = window.setTimeout(() => {
      lastSearchRef.current = searchText.trim();
      onSearch?.(searchText);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [onSearch, searchText]);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // La barre de recherche se colle sous la barre du haut, dont la hauteur varie
  useEffect(() => {
    const topbar = document.querySelector('.app-topbar');
    const toolbar = toolbarRef.current;
    if (!topbar || !toolbar) return undefined;
    const update = () => toolbar.style.setProperty('--messages-sticky-top', `${topbar.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(topbar);
    return () => observer.disconnect();
  }, [searchOpen]);

  if (!messages) return null;

  const closeSearch = () => {
    onCloseSearch?.();
    setSearchText('');
  };

  const toolbar = searchOpen ? (
    <div className="messages-toolbar" ref={toolbarRef}>
      <div className="messages-search" role="search">
        <svg className="messages-search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
        <input
          ref={inputRef}
          type="search"
          className="messages-search-input"
          value={searchText}
          placeholder="Rechercher dans les messages"
          aria-label="Rechercher dans les messages"
          onChange={(event) => setSearchText(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') closeSearch(); }}
        />
        <button type="button" className="messages-icon-btn" onClick={closeSearch} aria-label="Fermer la recherche" title="Fermer la recherche">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
        </button>
      </div>
    </div>
  ) : null;
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
      {toolbar}
      {messages.length === 0 ? (
        <p className="messages-empty">{query ? 'Aucun message ne correspond à la recherche.' : 'Aucun message reçu.'}</p>
      ) : (
    <ul className="messages-list" aria-label="Messages reçus">
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
      )}
    </div>
  );
}