import { useCallback, useEffect, useRef, useState } from 'react';

const THEME_KEY = 'ed_theme';
const THEME_OPTIONS = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];
const VIEW_OPTIONS = [
  { value: 'homework', label: 'Cahier de Texte' },
  { value: 'schedule', label: 'Emploi du temps' },
  { value: 'grades', label: 'Notes' },
];

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
        aria-label="Options de navigation et de thème"
        title="Options de navigation et de thème"
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {isOpen && (
        <div
          className="theme-menu-popover"
          id="app-more-menu"
          role="menu"
          aria-label="Options de l'application"
          onKeyDown={handleMenuKeyDown}
        >
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
              <span>{option.label}</span>
              {viewMode === option.value && <span aria-hidden="true">✓</span>}
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
              <span>{option.label}</span>
              {theme === option.value && <span aria-hidden="true">✓</span>}
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
