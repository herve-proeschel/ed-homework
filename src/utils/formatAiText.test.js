import { describe, expect, it } from 'vitest';
import { formatAiText, replaceLatexSymbols } from './formatAiText';

describe('formatAiText & replaceLatexSymbols', () => {
  it('handles empty or null text', () => {
    expect(formatAiText('')).toBe('');
    expect(formatAiText(null)).toBe('');
  });

  it('converts LaTeX math symbols to Unicode', () => {
    expect(replaceLatexSymbols('Singulier en -o $\\rightarrow$ Pluriel en ...?')).toBe(
      'Singulier en -o → Pluriel en ...?',
    );
    expect(replaceLatexSymbols('$a \\times b \\neq c$')).toBe('a × b ≠ c');
    expect(replaceLatexSymbols('$\\dots$')).toBe('…');
  });

  it('formats bold and italic text', () => {
    const html = formatAiText('Ceci est **important** et *remarquable*.');
    expect(html).toContain('<strong>important</strong>');
    expect(html).toContain('<em>remarquable</em>');
  });

  it('sanitizes dangerous HTML tags to prevent XSS', () => {
    const html = formatAiText('<script>alert("hack")</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert("hack")');
  });

  it('formats unordered loose lists with blank lines without creating multiple lists', () => {
    const input = [
      'Fais un tableau récapitulatif :',
      '* Singulier masculin en -o $\\rightarrow$ Pluriel en ...?',
      '',
      '* Singulier féminin en -a $\\rightarrow$ Pluriel en ...?',
      '',
      '* Singulier (masc. ou fém.) en -e $\\rightarrow$ Pluriel en ...?',
      '',
      'Note les cas particuliers vus en classe :',
    ].join('\n');

    const html = formatAiText(input);

    // Vérifie qu'il n'y a qu'une seule balise <ul> ouvrante et fermante pour ces puces
    const ulMatches = html.match(/<ul>/g) || [];
    expect(ulMatches.length).toBe(1);

    // Vérifie le décodage de la flèche
    expect(html).toContain('Singulier masculin en -o → Pluriel en ...?');
    expect(html).toContain('Singulier féminin en -a → Pluriel en ...?');
    expect(html).toContain('<p>Note les cas particuliers vus en classe :</p>');
  });

  it('formats markdown tables into structured HTML tables', () => {
    const input = [
      '| Singulier | Pluriel | Exemple |',
      '| :--- | :--- | :--- |',
      '| -o | -i | un ragazzo $\\rightarrow$ due ragazzi |',
      '| -a | -e | una ragazza $\\rightarrow$ due ragazze |',
    ].join('\n');

    const html = formatAiText(input);
    expect(html).toContain('<div class="ai-table-wrapper">');
    expect(html).toContain('Singulier</th>');
    expect(html).toContain('Pluriel</th>');
    expect(html).toContain('un ragazzo → due ragazzi</td>');
  });

  it('preserves and renders interactive details and summary tags for dynamic quizzes', () => {
    const input = [
      '### Question 1 : Les pourcentages',
      'Quel est le prix soldé ?',
      '',
      '<details>',
      '<summary>💡 Voir l\'indice / la réponse</summary>',
      '',
      '* **Indice :** Prendre 30 % de 50 €',
      '* **Correction :** 35 €',
      '</details>',
    ].join('\n');

    const html = formatAiText(input);
    expect(html).toContain('<details>');
    expect(html).toContain('<summary>💡 Voir l\'indice / la réponse</summary>');
    expect(html).toContain('<strong>Indice :</strong>');
    expect(html).toContain('<strong>Correction :</strong>');
    expect(html).not.toContain('&lt;details&gt;');
    expect(html).not.toContain('&lt;summary&gt;');
  });
});
