// mobile/app/src/theme.ts
import { MD3DarkTheme } from 'react-native-paper';

export const IMAGINEAI_THEME = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#B7FF35', // accent
    background: '#080B0A',
    surface: '#111713',
    text: '#F4F7F0',
    disabled: '#182019',
    placeholder: '#A5B1A7',
    accentGreen: '#8DDB39',
  },
};
