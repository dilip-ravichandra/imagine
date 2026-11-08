import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, R } from '../theme/tokens';
import { Badge, PrimaryButton, OutlineButton, Card } from '../components/ui';
import { ModelSelector } from '../components/ModelSelector';
import { generateImage } from '../api/client';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const STYLES_LIST = ['Realistic', 'Anime', 'Digital Art', 'Oil Painting', 'Sketch', 'Fantasy'];
const ASPECTS = ['1:1', '16:9', '4:3', '3:4', '9:16'];
const QUALITIES = ['Draft', 'Standard', 'Best'];
const GALLERY_KEY = 'galleryAssets';

export default function CreateStudioScreen() {
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState('sd_1.5');
  const [style, setStyle] = useState('Realistic');
  const [aspect, setAspect] = useState('1:1');
  const [quality, setQuality] = useState('Standard');
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const downloadToCache = async (url: string): Promise<string> => {
    const name = `${uuidv4()}.png`;
    const local = `${FileSystem.cacheDirectory}${name}`;
    const dl = await FileSystem.downloadAsync(url, local);
    return dl.uri;
  };

  const saveToGallery = async (uri: string) => {
    const asset = { id: uuidv4(), uri, modelId, createdAt: new Date().toISOString(), category: 'Single' };
    const stored = await AsyncStorage.getItem(GALLERY_KEY);
    const list = stored ? JSON.parse(stored) : [];
    list.push(asset);
    await AsyncStorage.setItem(GALLERY_KEY, JSON.stringify(list));
    setGalleryItems((prev) => [...prev, uri]);
    setSaved(true);
  };

  const onGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setSaved(false);
    try {
      const res = await generateImage({ model_id: modelId, prompt, steps: quality === 'Best' ? 50 : 30 });
      const local = await downloadToCache(res.image_url);
      setImageUri(local);
      await saveToGallery(local);
    } catch (e) {
      Alert.alert('Generation failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <View style={styles.toolbarIcon}><Text>🎨</Text></View>
            <View>
              <Text style={styles.toolbarTitle}>Image Generator</Text>
              <Badge label="Professional Studio" />
            </View>
          </View>
        </View>

        {/* ── Settings Row ────────────────────────────────────────────── */}
        <View style={styles.settingsRow}>
          <ModelSelector value={modelId} onChange={setModelId} />
        </View>

        {/* ── Style / Aspect / Quality pills ──────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
          {STYLES_LIST.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setStyle(s)}
              style={[styles.optionPill, style === s && styles.optionPillActive]}
            >
              <Text style={[styles.optionPillText, style === s && styles.optionPillTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.row}>
          {ASPECTS.map((a) => (
            <TouchableOpacity
              key={a}
              onPress={() => setAspect(a)}
              style={[styles.smallPill, aspect === a && styles.smallPillActive]}
            >
              <Text style={[styles.smallPillText, aspect === a && styles.smallPillTextActive]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Main Stage ──────────────────────────────────────────────── */}
        <View style={styles.mainStage}>
          {/* Header */}
          <View style={styles.stageHeader}>
            <View style={styles.stageHeaderLeft}>
              <Badge label="Active Generation" />
              {imageUri && <Badge label={modelId} style={{ marginLeft: 6 }} />}
            </View>
            {imageUri && (
              <View style={styles.stageActions}>
                <TouchableOpacity style={styles.iconBtn}><Text>🔄</Text></TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn}><Text>⬇️</Text></TouchableOpacity>
              </View>
            )}
          </View>

          {/* Image display */}
          <View style={styles.imageContainer}>
            {loading ? (
              <View style={styles.loadingBox}>
                <Text style={styles.spinnerEmoji}>✦</Text>
                <Text style={styles.loadingText}>Generating…</Text>
                <ActivityIndicator color={C.accent} style={{ marginTop: 8 }} />
              </View>
            ) : imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.resultImage} resizeMode="contain" />
            ) : (
              <View style={styles.emptyStage}>
                <Text style={styles.emptyStageEmoji}>🎨</Text>
                <Text style={styles.emptyStageText}>Enter a prompt and hit Generate</Text>
              </View>
            )}

            {/* Tag overlays */}
            {imageUri && (
              <View style={styles.tagOverlay}>
                <View style={styles.tag}><Text style={styles.tagText}>{style}</Text></View>
                <View style={[styles.tag, { marginLeft: 4 }]}><Text style={styles.tagText}>{aspect}</Text></View>
              </View>
            )}
          </View>

          {/* Saved badge */}
          {saved && (
            <View style={styles.savedBadge}>
              <Text style={styles.savedText}>✓ Saved to Gallery</Text>
            </View>
          )}
        </View>

        {/* ── Filmstrip ───────────────────────────────────────────────── */}
        {galleryItems.length > 0 && (
          <View style={styles.filmstripWrap}>
            <Text style={styles.filmstripLabel}>Session</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {galleryItems.map((uri, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setImageUri(uri)}
                  style={[styles.filmThumb, imageUri === uri && styles.filmThumbActive]}
                >
                  <Image source={{ uri }} style={styles.filmThumbImg} />
                  {imageUri === uri && <View style={styles.filmDot} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* ── Fixed Prompt Dock ───────────────────────────────────────────── */}
      <View style={styles.promptDock}>
        <View style={styles.promptRow}>
          <TouchableOpacity style={styles.dockIcon}><Text>📎</Text></TouchableOpacity>
          <TouchableOpacity style={styles.dockIcon}><Text>🎤</Text></TouchableOpacity>
          <TextInput
            placeholder="Describe your image…"
            placeholderTextColor={C.textMuted}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            style={styles.promptInput}
          />
          <TouchableOpacity
            onPress={onGenerate}
            disabled={loading || !prompt.trim()}
            style={[styles.generateBtn, (loading || !prompt.trim()) && { opacity: 0.4 }]}
          >
            <Text style={styles.generateBtnText}>⚡ Generate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 120 },

  /* Toolbar */
  toolbar: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toolbarIcon: {
    width: 36,
    height: 36,
    backgroundColor: C.accent,
    borderRadius: R.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 },

  /* Settings */
  settingsRow: { marginBottom: 10 },
  pillsScroll: { marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },

  optionPill: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.xs,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  optionPillActive: { backgroundColor: C.accentTranslucent, borderColor: C.accent },
  optionPillText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },
  optionPillTextActive: { color: C.accent },

  smallPill: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.nano,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  smallPillActive: { backgroundColor: C.accentTranslucent, borderColor: C.accent },
  smallPillText: { color: C.textSecondary, fontSize: 11, fontWeight: '600' },
  smallPillTextActive: { color: C.accent },

  /* Main Stage */
  mainStage: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.xl,
    overflow: 'hidden',
    marginBottom: 14,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  stageHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  stageActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    backgroundColor: C.hover,
    borderRadius: R.nano,
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageContainer: {
    minHeight: 280,
    backgroundColor: C.bg,
    margin: 14,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loadingBox: { alignItems: 'center' },
  spinnerEmoji: { fontSize: 32, color: C.accent },
  loadingText: { color: C.accent, marginTop: 8, fontSize: 13 },
  resultImage: { width: '100%', height: 280 },
  emptyStage: { alignItems: 'center' },
  emptyStageEmoji: { fontSize: 48, marginBottom: 12 },
  emptyStageText: { color: C.textMuted, fontSize: 13 },

  tagOverlay: { position: 'absolute', top: 10, left: 10, flexDirection: 'row' },
  tag: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.tiny,
  },
  tagText: { color: C.textSecondary, fontSize: 10 },

  savedBadge: {
    backgroundColor: C.accentTranslucent,
    borderTopWidth: 1,
    borderTopColor: C.accentBorder,
    padding: 8,
    alignItems: 'center',
  },
  savedText: { color: C.accent, fontSize: 12, fontWeight: '600' },

  /* Filmstrip */
  filmstripWrap: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.md,
    padding: 12,
    marginBottom: 14,
  },
  filmstripLabel: { color: C.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  filmThumb: {
    width: 90,
    height: 65,
    borderRadius: R.xxs,
    overflow: 'hidden',
    marginRight: 8,
    borderWidth: 2,
    borderColor: C.border,
  },
  filmThumbActive: { borderColor: C.accent },
  filmThumbImg: { width: '100%', height: '100%' },
  filmDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
  },

  /* Prompt Dock */
  promptDock: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: C.surfaceDark,
    borderColor: C.borderElevated,
    borderWidth: 1,
    borderRadius: R.xl,
    padding: 10,
  },
  promptRow: { flexDirection: 'row', alignItems: 'center' },
  dockIcon: {
    width: 34,
    height: 34,
    borderRadius: R.xs,
    backgroundColor: C.hover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  promptInput: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 13,
    maxHeight: 80,
    marginRight: 8,
  },
  generateBtn: {
    backgroundColor: C.accent,
    borderRadius: R.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  generateBtnText: { color: C.bg, fontWeight: '700', fontSize: 13 },
});
