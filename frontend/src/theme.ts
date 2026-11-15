import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

// "Sunrise studio": warm cream canvas, white cards, indigo for primary actions, coral for highlights.
// One accent per screen, generous spacing, large type, soft shadows: easy on the eyes and easy to scan.
export const palette = {
  canvas: '#FBF8F4',
  card: '#FFFFFF',
  soft: '#F7F3EE',
  hover: '#EFE8DF',
  border: '#E3DACF',
  ink: '#1E2233',
  inkSoft: '#5B6277',
  inkMute: '#8A90A2',
  primary: '#5B5BF0',
  primaryDark: '#4747DB',
  primaryTint: '#EEF0FF',
  coral: '#FF6B57',
  coralTint: '#FFEDEA',
  success: '#1FA971',
  warning: '#C77700',
  danger: '#E5484D',
};

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  fonts: {
    heading: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    body: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  styles: {
    global: {
      'html, body': {
        bg: palette.canvas,
        color: palette.ink,
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        fontSize: '16px',
        lineHeight: 1.55,
        WebkitFontSmoothing: 'antialiased',
      },
      '*': { boxSizing: 'border-box' },
      '*:focus-visible': { outline: `3px solid ${palette.primary}`, outlineOffset: '2px' },
      '::-webkit-scrollbar': { width: '8px' },
      '::-webkit-scrollbar-track': { bg: palette.canvas },
      '::-webkit-scrollbar-thumb': { bg: palette.border, borderRadius: '4px' },
      '::-webkit-scrollbar-thumb:hover': { bg: '#CFC4B6' },
    },
  },
  colors: {
    brand: {
      50: '#EEF0FF', 100: '#DDE0FF', 200: '#C5CAFF', 300: '#9CA3FF', 400: '#7C7CF5',
      500: '#5B5BF0', 600: '#4747DB', 700: '#3B3BC4', 800: '#2E2E96', 900: '#1F1F6B',
    },
    surface: { bg: palette.canvas, card: palette.card, elevated: palette.soft, sidebar: palette.card, input: palette.soft, hover: palette.hover, border: palette.border },
    text: { primary: palette.ink, secondary: palette.inkSoft, muted: palette.inkMute },
  },
  radii: { md: '10px', lg: '14px', xl: '18px', '2xl': '24px' },
  shadows: {
    card: '0 1px 2px rgba(30,34,51,0.05), 0 6px 20px rgba(30,34,51,0.06)',
    lifted: '0 10px 30px rgba(30,34,51,0.12)',
  },
  components: {
    Button: {
      baseStyle: { fontWeight: 600, borderRadius: '12px' },
      variants: {
        brand: {
          bg: palette.primary,
          color: '#FFFFFF',
          _hover: { bg: palette.primaryDark, transform: 'translateY(-1px)', _disabled: { bg: palette.primary } },
          _active: { bg: '#3B3BC4', transform: 'translateY(0)' },
          transition: 'all 0.15s ease',
        },
        ghost: { color: palette.inkSoft, _hover: { bg: palette.hover, color: palette.ink } },
        outline: { borderColor: palette.border, color: palette.ink, _hover: { bg: palette.primaryTint, borderColor: palette.primary } },
      },
    },
    Input: {
      variants: {
        filled: {
          field: {
            bg: palette.card, border: `1px solid ${palette.border}`, color: palette.ink, borderRadius: '12px',
            _hover: { bg: palette.card, borderColor: '#CFC4B6' },
            _focus: { bg: palette.card, borderColor: palette.primary, boxShadow: `0 0 0 3px ${palette.primaryTint}` },
            _placeholder: { color: palette.inkMute },
          },
        },
      },
      defaultProps: { variant: 'filled' },
    },
    Select: {
      variants: {
        filled: {
          field: {
            bg: palette.card, border: `1px solid ${palette.border}`, color: palette.ink, borderRadius: '12px',
            _hover: { bg: palette.card, borderColor: '#CFC4B6' },
            _focus: { borderColor: palette.primary, boxShadow: `0 0 0 3px ${palette.primaryTint}` },
          },
        },
      },
      defaultProps: { variant: 'filled' },
    },
    Tabs: {
      variants: {
        'soft-rounded': {
          tab: { color: palette.inkSoft, fontWeight: 500, _selected: { bg: palette.primary, color: '#FFFFFF', fontWeight: 600 } },
        },
      },
    },
  },
});

export default theme;
