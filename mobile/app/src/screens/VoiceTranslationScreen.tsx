import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Button as RNButton, Alert } from 'react-native';
import { TextInput, Button, ActivityIndicator, Snackbar, Avatar } from 'react-native-paper';
import { Audio } from 'expo-av';
import { LanguageSelector } from '../components/LanguageSelector';
// ... existing imports

import * as FileSystem from 'expo-file-system';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VoiceAsset {
  id: string;
  audioUri: string; // local cached audio file uri (TTS output)
  transcript: string;
  translation?: string;
  createdAt: string;
}

const VOICE_KEY = 'voiceAssets';

export default function VoiceTranslationScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [targetLang, setTargetLang] = useState('hi'); // default Hindi
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
    } catch (e) {
      Alert.alert('Recording error', (e as Error).message);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (uri) await handleTranscribe(uri);
    } catch (e) {
      Alert.alert('Stop error', (e as Error).message);
    }
  };

  const handleTranscribe = async (uri: string) => {
    setLoading(true);
    try {
      const res = await transcribeAudio(uri);
      const txt = res.text as string;
      setTranscript(txt);
      setSnackbarMsg('Transcription completed');
      setSnackbarVisible(true);
    } catch (e) {
      Alert.alert('Transcription error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!transcript) return;
    setLoading(true);
    try {
      const res = await translateText({ text: transcript, target_lang: targetLang }); // translate to selected language
      const txt = res.translated_text as string;
      setTranslation(txt);
      setSnackbarMsg('Translation completed');
      setSnackbarVisible(true);
    } catch (e) {
      Alert.alert('Translation error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTTS = async () => {
    if (!transcript) return;
    setLoading(true);
    try {
      const res = await tts({ text: transcript, voice: 'en-US' });
      const audioUrl = res.audio_url as string;
      const localUri = `${FileSystem.cacheDirectory}${uuidv4()}.mp3`;
      const dl = await FileSystem.downloadAsync(audioUrl, localUri);
      const { sound } = await Audio.Sound.createAsync({ uri: dl.uri });
      await sound.playAsync();
      // Save to local assets
      const asset: VoiceAsset = { id: uuidv4(), audioUri: dl.uri, transcript, createdAt: new Date().toISOString() };
      const stored = await AsyncStorage.getItem(VOICE_KEY);
      const list: VoiceAsset[] = stored ? JSON.parse(stored) : [];
      list.push(asset);
      await AsyncStorage.setItem(VOICE_KEY, JSON.stringify(list));
      setSnackbarMsg('TTS played & saved');
      setSnackbarVisible(true);
    } catch (e) {
      Alert.alert('TTS error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Voice & Translation</Text>
      <Button mode="contained" onPress={recording ? stopRecording : startRecording} style={styles.btn}>
        {recording ? 'Stop Recording' : 'Start Recording'}
      </Button>
      {loading && <ActivityIndicator style={styles.loader} />}
      <TextInput label="Transcription" mode="outlined" value={transcript} multiline numberOfLines={3} style={styles.input} editable={false} />
      <LanguageSelector value={targetLang} onChange={setTargetLang} />
      <Button mode="outlined" onPress={handleTranslate} disabled={!transcript} style={styles.btn}>Translate ({targetLang.toUpperCase()})</Button>
      <TextInput label="Translation" mode="outlined" value={translation} multiline numberOfLines={3} style={styles.input} editable={false} />
      <Button mode="contained" onPress={handleTTS} disabled={!transcript} style={styles.btn}>Play Text‑to‑Speech</Button>
      <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={3000}>{snackbarMsg}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#080B0A' },
  title: { marginBottom: 12, textAlign: 'center', color: '#B7FF35' },
  btn: { marginVertical: 8 },
  input: { marginVertical: 8 },
  loader: { marginVertical: 8 },
});
