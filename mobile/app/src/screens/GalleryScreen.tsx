import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, FlatList, Alert, TouchableOpacity } from 'react-native';
import { Text, IconButton, Snackbar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

interface GalleryAsset {
  id: string;
  uri: string; // local file uri
  modelId: string;
  createdAt: string;
}

const GALLERY_KEY = 'galleryAssets';

export default function GalleryScreen() {
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const loadAssets = async () => {
    const stored = await AsyncStorage.getItem(GALLERY_KEY);
    const parsed: GalleryAsset[] = stored ? JSON.parse(stored) : [];
    setAssets(parsed.reverse()); // newest first
  };

  useEffect(() => {
    const unsubscribe = loadAssets();
    // reload when screen focuses (optional – we could use navigation listeners)
    return () => {};
  }, []);

  const deleteAsset = async (id: string) => {
    const filtered = assets.filter((a) => a.id !== id);
    await AsyncStorage.setItem(GALLERY_KEY, JSON.stringify(filtered));
    setAssets(filtered);
    setSnackbarMsg('Deleted from Gallery');
    setSnackbarVisible(true);
  };

  const renderItem = ({ item }: { item: GalleryAsset }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.uri }} style={styles.image} />
      <View style={styles.captionRow}>
        <Text style={styles.caption}>Model: {item.modelId}</Text>
        <IconButton icon="delete" size={20} onPress={() => Alert.alert('Delete?', 'Remove this image?', [{ text: 'Cancel' }, { text: 'Delete', onPress: () => deleteAsset(item.id) }])} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {assets.length === 0 ? (
        <Text style={styles.empty}>No images in Gallery yet.</Text>
      ) : (
        <FlatList data={assets} renderItem={renderItem} keyExtractor={(i) => i.id} />
      )}
      <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={2500}>
        {snackbarMsg}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 8, backgroundColor: '#080B0A' },
  card: { marginBottom: 12, backgroundColor: '#111713', borderRadius: 8, overflow: 'hidden' },
  image: { width: '100%', height: 250, resizeMode: 'cover' },
  captionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8 },
  caption: { color: '#F4F7F0', fontSize: 12 },
  empty: { color: '#A5B1A7', textAlign: 'center', marginTop: 40 },
});
