import React, { createContext, useState, useContext, ReactNode } from 'react';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const LightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#B7FF35',
    background: '#FFFFFF',
    surface: '#F4F7F0',
    text: '#080B0A',
    disabled: '#E0E0E0',
    placeholder: '#A5B1A7',
    accentGreen: '#8DDB39',
  },
};

export const DarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#B7FF35',
    background: '#080B0A',
    surface: '#111713',
    text: '#F4F7F0',
    disabled: '#182019',
    placeholder: '#A5B1A7',
    accentGreen: '#8DDB39',
  },
};

interface ThemeContextProps {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps>({ isDark: true, toggleTheme: () => {} });

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(true);
  const toggleTheme = () => setIsDark((prev) => !prev);
  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);
