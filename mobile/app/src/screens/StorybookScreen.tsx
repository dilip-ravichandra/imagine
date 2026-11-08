import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Image, ActivityIndicator, Alert,
} from 'react-native';
import { C, R } from '../theme/tokens';
import { Badge } from '../components/ui';
import { ModelSelector } from '../components/ModelSelector';
import { generateImage } from '../api/client';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const GENRES = ['Adventure', 'Fantasy', 'Sci-Fi', 'Children\'s', 'Romance', 'Horror'];
const ART_STYLES = ['Illustration', 'Watercolor', 'Anime', 'Realistic', 'Comic'];
const GALLERY_KEY = 'galleryAssets';

export default function StorybookScreen() {
  const [storyPrompt, setStoryPrompt] = useState('');
  const [genre, setGenre] = useState('Fantasy');
  const [artStyle, setArtStyle] = useState('Illustration');
  const [modelId, setModelId] = useState('sdxl');
  const [sceneCount, setSceneCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [scenes, setScenes] = useState<{ uri: string; caption: string }[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const downloadToCache = async (url: string) => {
    const local = `${FileSystem.cacheDirectory}${uuidv4()}.png`;
    const dl = await FileSystem.downloadAsync(url, local);
    return dl.uri;
  };

  const saveScenes = async (uris: string[]) => {
    const stored = await AsyncStorage.getItem(GALLERY_KEY);
    const list = stored ? JSON.parse(stored) : [];
    uris.forEach((uri) =>
      list.push({ id: uuidv4(), uri, modelId, createdAt: new Date().toISOString(), category: 'Storybook' })
    );
    await AsyncStorage.setItem(GALLERY_KEY, JSON.stringify(list));
  };

  const onGenerate = async () => {
    if (!storyPrompt.trim()) return;
    setLoading(true);
    setScenes([]);
    try {
      const newScenes: { uri: string; caption: string }[] = [];
      for (let i = 0; i < sceneCount; i++) {
        const scenePrompt = `${storyPrompt} – ${genre} style, ${artStyle} art – scene ${i + 1} of ${sceneCount}`;
        const res = await generateImage({ model_id: modelId, prompt: scenePrompt });
        const uri = await downloadToCache(res.image_url);
        newScenes.push({ uri, caption: `Scene ${i + 1}: ${storyPrompt.substring(0, 60)}…` });
        setScenes([...newScenes]);
      }
      await saveScenes(newScenes.map((s) => s.uri));
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const active = scenes[activeIdx];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <View style={styles.toolbarIcon}><Text>📖</Text></View>
            <View>
              <Text style={styles.toolbarTitle}>Storybook Studio</Text>
              <Badge label="Scene Generator" />
            </View>
          </View>
        </View>

        {/* ── Genre & Art Style pills ──────────────────────────────────── */}
        <Text style={styles.rowLabel}>Genre</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {GENRES.map((g) => (
            <TouchableOpacity key={g} onPress={() => setGenre(g)}
              style={[styles.pill, genre === g && styles.pillActive]}>
              <Text style={[styles.pillText, genre === g && styles.pillTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.rowLabel}>Art Style</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {ART_STYLES.map((a) => (
            <TouchableOpacity key={a} onPress={() => setArtStyle(a)}
              style={[styles.pill, artStyle === a && styles.pillActive]}>
              <Text style={[styles.pillText, artStyle === a && styles.pillTextActive]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ModelSelector value={modelId} onChange={setModelId} />

        {/* ── Scene count ───────────────────────────────────────────────── */}
        <View style={styles.sceneCountRow}>
          <Text style={styles.rowLabel}>Scenes</Text>
          <View style={styles.sceneCountBtns}>
            {[2, 3, 4, 6].map((n) => (
              <TouchableOpacity key={n} onPress={() => setSceneCount(n)}
                style={[styles.smallPill, sceneCount === n && styles.smallPillActive]}>
                <Text style={[styles.smallPillText, sceneCount === n && styles.smallPillTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Active Scene Card ─────────────────────────────────────────── */}
        {(scenes.length > 0 || loading) && (
          <View style={styles.mainStage}>
            {/* Header */}
            <View style={styles.stageHeader}>
              <Badge label={`Active Scene ${activeIdx + 1}`} />
              {active && <Text style={styles.sceneTitle}>{`${genre} · ${artStyle}`}</Text>}
            </View>

            {/* Image */}
            <View style={styles.imageContainer}>
              {loading && !active ? (
                <View style={styles.loadingBox}>
                  <Text style={styles.spinnerEmoji}>✦</Text>
                  <Text style={styles.loadingText}>Generating scenes…</Text>
                  <ActivityIndicator color={C.accent} style={{ marginTop: 8 }} />
                </View>
              ) : active ? (
                <Image source={{ uri: active.uri }} style={styles.sceneImage} resizeMode="cover" />
              ) : null}

              {/* Comic dialogue balloon */}
              {active && (
                <View style={styles.dialogBalloon}>
                  <Text style={styles.dialogText}>💬 {active.caption}</Text>
                </View>
              )}
            </View>

            {/* Narration */}
            {active && (
              <View style={styles.narrationBox}>
                <Text style={styles.narrationText}>{active.caption}</Text>
              </View>
            )}

            {/* Prev / Next */}
            {scenes.length > 1 && (
              <View style={styles.stepper}>
                <TouchableOpacity
                  onPress={() => setActiveIdx((i) => Math.max(0, i - 1))}
                  disabled={activeIdx === 0}
                  style={[styles.stepBtn, activeIdx === 0 && { opacity: 0.3 }]}>
                  <Text style={styles.stepBtnText}>‹ Prev</Text>
                </TouchableOpacity>
                <Text style={styles.stepMeta}>{activeIdx + 1} / {scenes.length}</Text>
                <TouchableOpacity
                  onPress={() => setActiveIdx((i) => Math.min(scenes.length - 1, i + 1))}
                  disabled={activeIdx === scenes.length - 1}
                  style={[styles.stepBtn, activeIdx === scenes.length - 1 && { opacity: 0.3 }]}>
                  <Text style={styles.stepBtnText}>Next ›</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Filmstrip ─────────────────────────────────────────────────── */}
        {scenes.length > 0 && (
          <View style={styles.filmstripWrap}>
            <Text style={styles.rowLabel}>All Scenes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {scenes.map((s, i) => (
                <TouchableOpacity key={i} onPress={() => setActiveIdx(i)}
                  style={[styles.filmThumb, i === activeIdx && styles.filmThumbActive]}>
                  <Image source={{ uri: s.uri }} style={styles.filmThumbImg} />
                  <View style={styles.sceneLabel}>
                    <Text style={styles.sceneLabelText}>P{i + 1}</Text>
                  </View>
                  {i === activeIdx && <View style={styles.filmDot} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* ── Fixed Story Prompt Dock ───────────────────────────────────── */}
      <View style={styles.promptDock}>
        <View style={styles.promptRow}>
          <TouchableOpacity style={styles.dockIcon}><Text>🎤</Text></TouchableOpacity>
          <TextInput
            placeholder="Describe your story…"
            placeholderTextColor={C.textMuted}
            value={storyPrompt}
            onChangeText={setStoryPrompt}
            style={styles.promptInput}
          />
          <TouchableOpacity
            onPress={onGenerate}
            disabled={loading || !storyPrompt.trim()}
            style={[styles.generateBtn, (loading || !storyPrompt.trim()) && { opacity: 0.4 }]}>
            <Text style={styles.generateBtnText}>📖 Generate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 120 },

  toolbar: {
    backgroundColor: C.surface, borderColor: C.border, borderWidth: 1,
    borderRadius: R.lg, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', marginBottom: 14,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toolbarIcon: {
    width: 36, height: 36, backgroundColor: C.accent,
    borderRadius: R.xs, alignItems: 'center', justifyContent: 'center',
  },
  toolbarTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 },

  rowLabel: { color: C.textSecondary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },

  pill: {
    backgroundColor: C.surface, borderColor: C.border, borderWidth: 1,
    borderRadius: R.xs, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8,
  },
  pillActive: { backgroundColor: C.accentTranslucent, borderColor: C.accent },
  pillText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: C.accent },

  sceneCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
  sceneCountBtns: { flexDirection: 'row', gap: 6 },
  smallPill: {
    backgroundColor: C.surface, borderColor: C.border, borderWidth: 1,
    borderRadius: R.nano, paddingHorizontal: 10, paddingVertical: 5,
  },
  smallPillActive: { backgroundColor: C.accentTranslucent, borderColor: C.accent },
  smallPillText: { color: C.textSecondary, fontSize: 11, fontWeight: '600' },
  smallPillTextActive: { color: C.accent },

  mainStage: {
    backgroundColor: C.surface, borderColor: C.border, borderWidth: 1,
    borderRadius: R.xl, overflow: 'hidden', marginBottom: 14,
  },
  stageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  sceneTitle: { color: C.textSecondary, fontSize: 12 },

  imageContainer: {
    minHeight: 260, backgroundColor: C.bg, margin: 14,
    borderRadius: R.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  sceneImage: { width: '100%', height: 260 },
  loadingBox: { alignItems: 'center' },
  spinnerEmoji: { fontSize: 32, color: C.accent },
  loadingText: { color: C.accent, marginTop: 8, fontSize: 13 },

  dialogBalloon: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    backgroundColor: 'rgba(17,23,19,0.9)', borderColor: C.accent, borderWidth: 1,
    borderRadius: R.xs, padding: 10,
  },
  dialogText: { color: C.textSecondary, fontSize: 12, fontStyle: 'italic' },

  narrationBox: {
    backgroundColor: C.surfaceDark, borderColor: C.border, borderWidth: 1,
    borderRadius: R.xs, margin: 14, marginTop: 0, padding: 12,
  },
  narrationText: { color: C.textSecondary, fontSize: 12, lineHeight: 20 },

  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: C.borderLight,
  },
  stepBtn: {
    backgroundColor: C.hover, borderRadius: R.nano, paddingHorizontal: 14, paddingVertical: 8,
  },
  stepBtnText: { color: C.textPrimary, fontSize: 13, fontWeight: '600' },
  stepMeta: { color: C.accent, fontSize: 13, fontWeight: '600' },

  filmstripWrap: {
    backgroundColor: C.surface, borderColor: C.border, borderWidth: 1,
    borderRadius: R.md, padding: 12, marginBottom: 14,
  },
  filmThumb: {
    width: 96, height: 68, borderRadius: R.xxs, overflow: 'hidden',
    marginRight: 8, borderWidth: 2, borderColor: C.border,
  },
  filmThumbActive: { borderColor: C.accent },
  filmThumbImg: { width: '100%', height: '100%' },
  sceneLabel: {
    position: 'absolute', top: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: R.micro, paddingHorizontal: 4, paddingVertical: 1,
  },
  sceneLabelText: { color: C.textPrimary, fontSize: 9 },
  filmDot: {
    position: 'absolute', bottom: 4, right: 4, width: 8, height: 8,
    borderRadius: 4, backgroundColor: C.accent,
  },

  promptDock: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: C.surfaceDark, borderColor: C.borderElevated, borderWidth: 1,
    borderRadius: R.xl, padding: 10,
  },
  promptRow: { flexDirection: 'row', alignItems: 'center' },
  dockIcon: {
    width: 34, height: 34, borderRadius: R.xs, backgroundColor: C.hover,
    alignItems: 'center', justifyContent: 'center', marginRight: 6,
  },
  promptInput: { flex: 1, color: C.textPrimary, fontSize: 13, marginRight: 8 },
  generateBtn: { backgroundColor: C.accent, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 10 },
  generateBtnText: { color: C.bg, fontWeight: '700', fontSize: 13 },
});
