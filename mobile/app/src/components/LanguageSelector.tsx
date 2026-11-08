import React from 'react';
import { Menu, Button } from 'react-native-paper';
import { View } from 'react-native';

interface LanguageOption {
  code: string;
  label: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'bn', label: 'Bengali' },
  { code: 'kn', label: 'Kannada' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ur', label: 'Urdu' },
];

interface Props {
  value: string;
  onChange: (code: string) => void;
}

export const LanguageSelector: React.FC<Props> = ({ value, onChange }) => {
  const [visible, setVisible] = React.useState(false);
  const selected = LANGUAGES.find((l) => l.code === value);
  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  return (
    <View style={{ marginVertical: 8 }}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={<Button mode="outlined" onPress={openMenu}>{selected?.label ?? 'Select language'}</Button>}
      >
        {LANGUAGES.map((lang) => (
          <Menu.Item
            key={lang.code}
            title={lang.label}
            onPress={() => {
              onChange(lang.code);
              closeMenu();
            }}
          />
        ))}
      </Menu>
    </View>
  );
};
