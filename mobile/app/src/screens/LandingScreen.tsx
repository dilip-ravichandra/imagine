import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { C, R } from '../theme/tokens';
import { Badge, PrimaryButton, OutlineButton } from '../components/ui';

const { width } = Dimensions.get('window');

const FEATURE_PILLS = [
  { emoji: '🎨', label: 'AI Generation' },
  { emoji: '✏️', label: 'Smart Editing' },
  { emoji: '📚', label: 'Education' },
  { emoji: '💬', label: 'Chat Assistant' },
];

const SHOWCASE = [
  { id: '1', label: 'Futuristic Cityscape' },
  { id: '2', label: 'Fantasy Forest' },
  { id: '3', label: 'Digital Portrait' },
];

export default function LandingScreen() {
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} bounces={false}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        {/* Ambient glow behind */}
        <View style={styles.ambientGlow} pointerEvents="none" />

        {/* Pill badge */}
        <View style={styles.pillBadge}>
          <Text style={styles.pillBadgeText}>✦ AI‑POWERED CREATIVE PLATFORM</Text>
        </View>

        {/* Headline */}
        <Text style={styles.heroHeading}>Turn Your Ideas Into{'\n'}Stunning Visuals with AI</Text>

        {/* Sub */}
        <Text style={styles.heroSub}>
          Create images, learn concepts, edit scenes and explore infinite possibilities.
        </Text>

        {/* CTA row */}
        <View style={styles.ctaRow}>
          <PrimaryButton
            label="Get Started"
            onPress={() => navigation.navigate('Dashboard')}
            style={{ flex: 1, marginRight: 10 }}
          />
          <OutlineButton
            label="Explore"
            onPress={() => navigation.navigate('Gallery')}
            style={{ flex: 1 }}
          />
        </View>

        {/* Feature pills */}
        <View style={styles.pillsRow}>
          {FEATURE_PILLS.map((p) => (
            <View key={p.label} style={styles.featurePill}>
              <Text style={styles.featurePillText}>{p.emoji} {p.label}</Text>
            </View>
          ))}
        </View>

        {/* Hero image card */}
        <View style={styles.heroImageCard}>
          <LinearGradient
            colors={['#1A2A1C', '#111713']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroImagePlaceholder}
          >
            <Text style={styles.heroImageEmoji}>🌆</Text>
            <Text style={styles.heroImagePrompt}>"A futuristic city at sunset"</Text>
          </LinearGradient>
          {/* Bottom overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(8,11,10,0.9)']}
            style={styles.heroImageOverlay}
          >
            <View style={styles.promptOfDay}>
              <Badge label="Prompt of the Day" />
              <Text style={styles.promptOfDayText}>Explore today's featured creation ✦</Text>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* ── Feature Cards ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Everything You Need</Text>
        <View style={styles.featureGrid}>
          {[
            { emoji: '🎨', title: 'AI Generation', desc: 'Text to image in seconds with multiple models.' },
            { emoji: '✏️', title: 'Smart Editing', desc: 'Inpaint, outpaint and refine with precision.' },
            { emoji: '📚', title: 'Learning Studio', desc: 'Visual explanations for any topic.' },
            { emoji: '💬', title: 'Chat Assistant', desc: 'Groq‑powered contextual assistant.' },
          ].map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <View style={styles.featureCardGlow} pointerEvents="none" />
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Showcase Gallery ──────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Showcase</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SHOWCASE.map((s) => (
            <View key={s.id} style={styles.showcaseCard}>
              <LinearGradient
                colors={['#182019', '#0D120E']}
                style={styles.showcaseImage}
              >
                <Text style={{ fontSize: 48 }}>🖼️</Text>
              </LinearGradient>
              <LinearGradient
                colors={['transparent', 'rgba(8,11,10,0.9)']}
                style={styles.showcaseOverlay}
              >
                <Text style={styles.showcaseLabel}>{s.label}</Text>
              </LinearGradient>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Text style={styles.footerLogo}>ImagineAI</Text>
        <Text style={styles.footerSub}>© 2026 ImagineAI. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },

  /* Hero */
  hero: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 24 },
  ambientGlow: {
    position: 'absolute',
    top: 60,
    left: width / 2 - 160,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(183,255,53,0.07)',
  },
  pillBadge: {
    backgroundColor: 'rgba(183,255,53,0.1)',
    borderColor: 'rgba(183,255,53,0.25)',
    borderWidth: 1,
    borderRadius: R.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  pillBadgeText: { color: C.accent, fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },
  heroHeading: {
    fontSize: 30,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -1,
    lineHeight: 36,
    marginBottom: 12,
  },
  heroSub: { color: C.textSecondary, fontSize: 15, lineHeight: 24, marginBottom: 20 },
  ctaRow: { flexDirection: 'row', marginBottom: 20 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  featurePill: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.xs,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  featurePillText: { color: C.textSecondary, fontSize: 12, fontWeight: '600' },

  heroImageCard: {
    borderRadius: R.xl2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    height: 220,
  },
  heroImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageEmoji: { fontSize: 56, marginBottom: 8 },
  heroImagePrompt: { color: C.textMuted, fontSize: 12, fontStyle: 'italic' },
  heroImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    justifyContent: 'flex-end',
    padding: 12,
  },
  promptOfDay: { gap: 4 },
  promptOfDayText: { color: C.textSecondary, fontSize: 12 },

  /* Sections */
  section: { paddingHorizontal: 20, marginTop: 32 },
  sectionTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 16 },

  /* Feature Grid */
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.sm,
    padding: 16,
    width: (width - 50) / 2,
    overflow: 'hidden',
  },
  featureCardGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(183,255,53,0.05)',
  },
  featureEmoji: { fontSize: 22, marginBottom: 8 },
  featureTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  featureDesc: { color: C.textSecondary, fontSize: 12, lineHeight: 18 },

  /* Showcase */
  showcaseCard: {
    width: 200,
    height: 160,
    borderRadius: R.md,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  showcaseImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  showcaseOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'flex-end',
    padding: 10,
  },
  showcaseLabel: { color: C.textPrimary, fontSize: 12, fontWeight: '600' },

  /* Footer */
  footer: {
    marginTop: 40,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
    alignItems: 'center',
  },
  footerLogo: { color: C.accent, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  footerSub: { color: C.textMuted, fontSize: 11 },
});
