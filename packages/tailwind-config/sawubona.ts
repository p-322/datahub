/**
 * Sawubona Commons design tokens.
 *
 * Derived from website/sawubona/src/assets/css/styles.css in the p-322
 * website monorepo. The site palette is intentionally muted and made for a
 * single reading page; the scales below keep that character but extend it
 * with the range an application UI needs (primary actions, selected
 * states, borders, feedback) and darken the muted/link tones so that text
 * meets WCAG AA on white.
 *
 * Semantic names, not brand names, so the next tenant is a token swap:
 *
 *   ink     grey-blue neutrals: page background, text, headings, dark bars
 *   accent  the Sawubona blue-grey: primary actions, links, rules, selected
 *           facets, hero text
 *
 * Deliberately no third hue: the site is two-tone and the green of the old
 * datahub is exactly what this theme replaces.
 */

export const ink = {
  50: '#f7f8fa',
  100: '#f2f2f5', // Site --bg
  200: '#e6e9ed',
  300: '#d9dde2', // Site --line
  400: '#b6bcc5',
  500: '#8c929b', // Site --muted (decorative only, fails AA on white)
  600: '#67707b', // Site "h2 + p" lead text
  700: '#4e5561', // Site --text
  800: '#3b4048', // Site --heading, footer
  900: '#2b2f36',
  950: '#1e2126',
} as const;

export const accent = {
  50: '#f1f5f7',
  100: '#e3ebee',
  200: '#c9d8de', // Site --accent
  300: '#9db2ba', // Site --accent-strong
  400: '#86a0aa',
  500: '#6e858e', // Site --accent-deep (links on the site)
  600: '#57707a', // AA on white – use for links and icon buttons
  700: '#465a63',
  800: '#36454c',
  900: '#263036',
} as const;

export const colors = {
  ink,
  accent,
  /** Page and card surfaces. */
  surface: {
    DEFAULT: '#ffffff',
    muted: ink[100],
    frost: 'rgba(255, 255, 255, 0.94)',
  },
  /** Body text and link colour, single-purpose aliases. */
  body: ink[700],
  heading: ink[800],
  link: accent[600],
  line: ink[300],
} as const;

export const fontFamily: Record<string, string[]> = {
  sans: [
    'var(--font-sans)',
    '"Avenir Next"',
    'Avenir',
    'Montserrat',
    '"Helvetica Neue"',
    'Helvetica',
    'Arial',
    'sans-serif',
  ],
  mono: [
    'SFMono-Regular',
    'Consolas',
    '"Liberation Mono"',
    'Menlo',
    'monospace',
  ],
};

export const boxShadow = {
  card: '0 30px 60px rgba(53, 58, 67, 0.12)',
  'card-sm': '0 12px 28px rgba(53, 58, 67, 0.07)',
  quote: '0 18px 35px rgba(53, 58, 67, 0.08)',
} as const;

export const backgroundImage = {
  /** Dark gradient laid over the hero photograph. */
  'hero-shade':
    'linear-gradient(180deg, rgba(59, 64, 72, 0.16) 0%, rgba(59, 64, 72, 0.55) 100%)',
  /** Short accent rule under section headings. */
  'heading-rule': `linear-gradient(90deg, ${accent[200]}, ${accent[300]})`,
} as const;
