import type {Config} from 'tailwindcss';
import formsPlugin from '@tailwindcss/forms';
import typographyPlugin from '@tailwindcss/typography';
import aspectRatioPlugin from '@tailwindcss/aspect-ratio';
import {
  colors,
  fontFamily,
  boxShadow,
  backgroundImage,
  ink,
  accent,
} from './sawubona';

export {colors, fontFamily, boxShadow, backgroundImage} from './sawubona';

export default {
  content: [
    'src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors,
      fontFamily,
      boxShadow,
      backgroundImage,
      letterSpacing: {
        heading: '0.08em',
        label: '0.12em',
        kicker: '0.24em',
      },
      typography: () => ({
        DEFAULT: {
          css: {
            color: ink[700],
            '--tw-prose-headings': ink[800],
            '--tw-prose-links': accent[600],
            '--tw-prose-bold': ink[800],
            '--tw-prose-quotes': ink[600],
            '--tw-prose-quote-borders': accent[200],
            '--tw-prose-hr': ink[300],
            '--tw-prose-th-borders': ink[300],
            '--tw-prose-td-borders': ink[300],
          },
        },
      }),
    },
  },
  plugins: [formsPlugin, typographyPlugin, aspectRatioPlugin],
} satisfies Config;
