import { useEffect, useRef, useState } from 'react';

const THEME_KEY = 'ed_theme';
const THEME_OPTIONS = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

function getStoredTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  return THEME_OPTIONS.some((option) => option.value === storedTheme) ? storedTheme : 'system';
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeMenu() {
  const [theme, setTheme] = useState(getStoredTheme);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

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
    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const selectTheme = (value) => {
    setTheme(value);
    localStorage.setItem(THEME_KEY, value);
    setIsOpen(false);
  };

  return (
    <div className="theme-menu" ref={menuRef}>
      <button
        type="button"
        className="theme-menu-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Choisir le thème"
        title="Choisir le thème"
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {isOpen && (
        <div className="theme-menu-popover" role="menu" aria-label="Thème de l'application">
          <p className="theme-menu-section-title">Thème</p>
          {THEME_OPTIONS.map((option) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={theme === option.value}
              className="theme-option"
              key={option.value}
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
