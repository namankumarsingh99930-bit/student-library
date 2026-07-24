/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171717',
        paper: '#FFFFFF',
        line: '#E7E5E4',
        shelf: {
          DEFAULT: '#0F6D5C',
          soft: '#E3F1EE',
        },
        index: {
          DEFAULT: '#C08A2E',
          soft: '#FBF1DE',
        },
        muted: '#78716C',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
