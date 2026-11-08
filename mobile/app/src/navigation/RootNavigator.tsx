import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import LandingScreen from '../screens/LandingScreen';
import CreateStudioScreen from '../screens/CreateStudioScreen';
import StorybookScreen from '../screens/StorybookScreen';
import GalleryScreen from '../screens/GalleryScreen';
import NotificationScreen from '../screens/NotificationScreen';
import ImagePickerScreen from '../screens/ImagePickerScreen';

// existing imports

import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';

import { Avatar } from 'react-native-paper';

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props) {
  return (
    <DrawerContentScrollView {...props} style={styles.drawer}>
      <View style={styles.header}>
        <Avatar.Text size={64} label="AI" />
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

export default function RootNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={CustomDrawerContent}
      screenOptions={{
        headerStyle: { backgroundColor: '#111713' },
        headerTintColor: '#B7FF35',
        drawerActiveTintColor: '#B7FF35',
        drawerInactiveTintColor: '#F4F7F0',
        drawerStyle: { backgroundColor: '#080B0A' },
      }}
    >
      <Drawer.Screen name="Home" component={LandingScreen} options={{ title: 'ImagineAI' }} />
      <Drawer.Screen name="Generate" component={CreateStudioScreen} options={{ title: 'Image Generator' }} />
      <Drawer.Screen name="Storybook" component={StorybookScreen} options={{ title: 'Storybook Studio' }} />
      <Drawer.Screen name="Gallery" component={GalleryScreen} options={{ title: 'Gallery & History' }} />
      <Drawer.Screen name="Notifications" component={NotificationScreen} options={{ title: 'Push Notifications' }} />
      <Drawer.Screen name="ImagePicker" component={ImagePickerScreen} options={{ title: 'Image Picker' }} />
      <Drawer.Screen name="Voice" component={require('../screens/VoiceTranslationScreen').default} options={{ title: 'Voice & Translation' }} />
      <Drawer.Screen name="Chat" component={require('../screens/ChatScreen').default} options={{ title: 'ImagineAI Chatbot' }} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawer: { backgroundColor: '#080B0A' },
  header: { alignItems: 'center', marginVertical: 20 },
});
