import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Button as RNButton, Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Permissions from 'expo-permissions';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function NotificationScreen() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // Request permissions on mount
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    // This listener is fired whenever a notification is received while the app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notif => {
      setNotification(notif);
    });

    // This listener is fired when a user taps on or interacts with a notification (foreground/background)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log(response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  const scheduleTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'ImagineAI Test',
        body: 'This is a test push notification.',
        data: { screen: 'Home' },
      },
      trigger: { seconds: 5 },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Push Notifications Demo</Text>
      <RNButton title="Schedule test notification (5s)" onPress={scheduleTestNotification} />
      {expoPushToken && <Text style={styles.token}>Expo token: {expoPushToken}</Text>}
      {notification && (
        <View style={styles.notifBox}>
          <Text>Last notification received:</Text>
          <Text>Title: {notification.request.content.title}</Text>
          <Text>Body: {notification.request.content.body}</Text>
        </View>
      )}
    </View>
  );
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    alert('Failed to get push token for push notification!');
    return null;
  }
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log('Expo push token:', token);
  return token;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080B0A', padding: 16 },
  title: { fontSize: 20, marginBottom: 12, color: '#B7FF35' },
  token: { marginTop: 12, color: '#F4F7F0' },
  notifBox: { marginTop: 20, padding: 12, backgroundColor: '#111713', borderRadius: 8 },
});
