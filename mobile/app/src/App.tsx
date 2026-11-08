import React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';
import { ThemeProvider, useThemeContext, LightTheme, DarkTheme } from './context/ThemeContext';

export default function App() {
  const { isDark } = useThemeContext();
  const theme = isDark ? DarkTheme : LightTheme;
  return (
    <ThemeProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </PaperProvider>
    </ThemeProvider>
  );
}
