import { useCallback, useEffect, useRef, useState } from 'react';

const THEME_KEY = 'ed_theme';
const THEME_OPTIONS = [
  { value: 'system', label: 'Système', icon: 'system' },
  { value: 'light', label: 'Clair', icon: 'light' },
  { value: 'dark', label: 'Sombre', icon: 'dark' },
];
const VIEW_OPTIONS = [
  { value: 'homework', label: 'Cahier de Texte', icon: 'homework' },
  { value: 'schedule', label: 'Emploi du temps', icon: 'schedule' },
  { value: 'grades', label: 'Notes', icon: 'grades' },
];

const MENU_ICONS = {
  homework: <><path d="M6 3.5h9l3 3V20.5H6z" /><path d="M15 3.5v4h3M9 12h6M9 16h6" /></>,
  schedule: <><rect x="4" y="5.5" width="16" height="15" rx="1.5" /><path d="M8 3.5v4M16 3.5v4M4 10h16M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" /></>,
  grades: <><path d="M5 19.5V11M10 19.5V7M15 19.5V13M20 19.5V4.5" /></>,
  system: <><rect x="3.5" y="4" width="17" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></>,
  light: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7L5.3 5.3" /></>,
  dark: <path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3z" />,
};

function MenuIcon({ name }) {
  return (
    <svg className="theme-option-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {MENU_ICONS[name]}
    </svg>
  );
}

function getStoredTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  return THEME_OPTIONS.some((option) => option.value === storedTheme) ? storedTheme : 'system';
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeMenu({ viewMode, onSelectView }) {
  const [theme, setTheme] = useState(getStoredTheme);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const menuItemRefs = useRef([]);

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const activeTheme = theme === 'system' ? getSystemTheme() : theme;
      document.documentElement.dataset.theme = activeTheme;
      document.documentElement.style.colorScheme = activeTheme;
    };

    applyTheme();
    const handleSystemThemeChange = () => {
      if (theme === 'system') applyTheme();
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [theme]);

  useEffect(() => {
    const handleOutsidePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) closeMenu();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        closeMenu(true);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeMenu, isOpen]);

  useEffect(() => {
    if (isOpen) {
      menuItemRefs.current[0]?.focus();
    }
  }, [isOpen]);

  const handleMenuKeyDown = (event) => {
    const items = menuItemRefs.current.filter(Boolean);
    const currentIndex = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[nextIndex]?.focus();
    } else if (event.key === 'Tab') {
      closeMenu();
    }
  };

  const selectTheme = (value) => {
    setTheme(value);
    localStorage.setItem(THEME_KEY, value);
    closeMenu(true);
  };

  return (
    <div className="theme-menu" ref={menuRef}>
      <button
        type="button"
        className="theme-menu-trigger"
        ref={triggerRef}
        onClick={() => {
          if (isOpen) closeMenu(true);
          else setIsOpen(true);
        }}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls="app-more-menu"
        aria-label="Menu principal"
        title="Menu principal"
      >
        <svg className="theme-menu-trigger-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      </button>
      {isOpen && <div className="theme-menu-scrim" onClick={() => closeMenu(true)} aria-hidden="true" />}
      {isOpen && (
        <div
          className="theme-menu-popover"
          id="app-more-menu"
          role="menu"
          aria-label="Menu principal"
          onKeyDown={handleMenuKeyDown}
        >
          <p className="theme-menu-drawer-title">Cahier de Texte</p>
          <p className="theme-menu-section-title">Navigation</p>
          {VIEW_OPTIONS.map((option, index) => (
            <button
              type="button"
              role="menuitem"
              aria-current={viewMode === option.value ? 'page' : undefined}
              className="theme-option"
              key={option.value}
              ref={(element) => { menuItemRefs.current[index] = element; }}
              onClick={() => {
                onSelectView(option.value);
                closeMenu(true);
              }}
            >
              <span className="theme-option-label">
                <MenuIcon name={option.icon} />
                <span>{option.label}</span>
              </span>
              {viewMode === option.value && <span className="theme-option-check" aria-hidden="true">✓</span>}
            </button>
          ))}
          <div className="theme-menu-divider" />
          <p className="theme-menu-section-title">Thème</p>
          {THEME_OPTIONS.map((option, index) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={theme === option.value}
              className="theme-option"
              key={option.value}
              ref={(element) => { menuItemRefs.current[VIEW_OPTIONS.length + index] = element; }}
              onClick={() => selectTheme(option.value)}
            >
              <span className="theme-option-label">
                <MenuIcon name={option.icon} />
                <span>{option.label}</span>
              </span>
              {theme === option.value && <span className="theme-option-check" aria-hidden="true">✓</span>}
            </button>
          ))}
          <div className="theme-menu-divider" />
          <section className="theme-menu-about" aria-labelledby="theme-menu-about-title">
            <h2 className="theme-menu-section-title" id="theme-menu-about-title">À propos</h2>
            <p>Cahier de Texte permet de consulter et d'imprimer les devoirs à venir depuis ÉcoleDirecte.</p>
            <a
              href="https://github.com/herve-proeschel/ed-homework"
              target="_blank"
              rel="noreferrer"
              role="menuitem"
            >
              Voir le projet sur GitHub
            </a>
          </section>
        </div>
      )}
    </div>
  );
}
