import { marked } from 'marked';

// Dictionnaire des symboles LaTeX courants vers leurs équivalents Unicode
const LATEX_SYMBOLS = [
  [/\\(?:rightarrow|to|longrightarrow)/g, '→'],
  [/\\(?:leftarrow|longleftarrow)/g, '←'],
  [/\\Rightarrow/g, '⇒'],
  [/\\Leftarrow/g, '⇐'],
  [/\\(?:Leftrightarrow|iff)/g, '⇔'],
  [/\\leftrightarrow/g, '↔'],
  [/\\(?:dots|ldots|cdots)/g, '…'],
  [/\\times/g, '×'],
  [/\\div/g, '÷'],
  [/\\(?:le|leq)/g, '≤'],
  [/\\(?:ge|geq)/g, '≥'],
  [/\\neq/g, '≠'],
  [/\\approx/g, '≈'],
  [/\\pm/g, '±'],
  [/\\in/g, '∈'],
  [/\\notin/g, '∉'],
  [/\\infty/g, '∞'],
  [/\\degree/g, '°'],
  [/\\(?:quad|qquad)/g, ' '],
];

export function replaceLatexSymbols(text) {
  if (!text) return '';
  let str = text;

  for (const [regex, replacement] of LATEX_SYMBOLS) {
    str = str.replace(regex, replacement);
  }

  // Nettoie les délimiteurs mathématiques $ ... $ ou $$ ... $$
  str = str.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  str = str.replace(/\$([^$\n]+?)\$/g, '$1');

  return str;
}

export function normalizeDetailsTags(text) {
  if (!text) return '';
  let str = text;
  // Assure un saut de ligne après <details> pour que marked parse le bloc correctement
  str = str.replace(/<details\b([^>]*)>\s*/gi, '<details$1>\n');
  // Assure un double saut de ligne après </summary> pour que le contenu intérieur soit interprété en Markdown
  str = str.replace(/<\/summary>\s*(?:\n)?/gi, '</summary>\n\n');
  // Assure un saut de ligne avant </details>
  str = str.replace(/\s*<\/details>/gi, '\n\n</details>');
  return str;
}

export function sanitizeHtml(html) {
  if (!html) return '';
  return html
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '')
    .replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .replace(/<\s*object\b[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '')
    .replace(/<\s*embed\b[^>]*>[\s\S]*?<\s*\/\s*embed\s*>/gi, '')
    .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
}

export function formatAiText(text) {
  if (!text) return '';

  // 1. Décodage des symboles LaTeX et des maths
  const cleanLatex = replaceLatexSymbols(text);

  // 2. Normalisation des balises interactives <details> et <summary>
  const normalized = normalizeDetailsTags(cleanLatex);

  // 3. Analyse Markdown standardisée via marked (GFM + line breaks)
  const parsedHtml = marked.parse(normalized, {
    gfm: true,
    breaks: true,
  });

  // 4. Encapsulation des tableaux dans un conteneur responsive pour mobile
  const withWrappedTables = parsedHtml.replace(
    /(<table>[\s\S]*?<\/table>)/g,
    '<div class="ai-table-wrapper">$1</div>',
  );

  // 5. Nettoyage de sécurité
  return sanitizeHtml(withWrappedTables);
}
