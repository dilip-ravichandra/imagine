import React from 'react';
import { Menu, Button, Divider, List } from 'react-native-paper';
import { View } from 'react-native';
import { MODEL_CATALOG } from '../../config/models';

interface Props {
  value: string;
  onChange: (modelId: string) => void;
}

export const ModelSelector: React.FC<Props> = ({ value, onChange }) => {
  const [visible, setVisible] = React.useState(false);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const selected = MODEL_CATALOG.find((m) => m.id === value);

  return (
    <View style={{ marginVertical: 8 }}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={<Button mode="outlined" onPress={openMenu}> {selected?.displayName ?? 'Select model'} </Button>}
      >
        {MODEL_CATALOG.map((model) => (
          <Menu.Item
            key={model.id}
            title={model.displayName}
            onPress={() => {
              onChange(model.id);
              closeMenu();
            }}
          />
        ))}
      </Menu>
      <Divider />
    </View>
  );
};
