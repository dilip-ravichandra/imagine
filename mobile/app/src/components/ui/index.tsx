import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { C, R } from '../theme/tokens';

// ─── Accent Badge ────────────────────────────────────────────────────────────
export const Badge = ({ label, style }: { label: string; style?: ViewStyle }) => (
  <View style={[styles.badge, style]}>
    <Text style={styles.badgeText}>{label.toUpperCase()}</Text>
  </View>
);

// ─── Section Header (title + "View all") ────────────────────────────────────
export const SectionHeader = ({
  title,
  onViewAll,
}: {
  title: string;
  onViewAll?: () => void;
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onViewAll && (
      <TouchableOpacity onPress={onViewAll}>
        <Text style={styles.viewAll}>View all →</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Primary Button ──────────────────────────────────────────────────────────
export const PrimaryButton = ({
  label,
  onPress,
  disabled,
  style,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.8}
    style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled, style]}
  >
    {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
    <Text style={styles.primaryBtnText}>{label}</Text>
  </TouchableOpacity>
);

// ─── Ghost / Outline Button ──────────────────────────────────────────────────
export const OutlineButton = ({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.outlineBtn, style]}>
    <Text style={styles.outlineBtnText}>{label}</Text>
  </TouchableOpacity>
);

// ─── Card wrapper ────────────────────────────────────────────────────────────
export const Card = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) => <View style={[styles.card, style]}>{children}</View>;

// ─── Dark Input ──────────────────────────────────────────────────────────────
export const DarkInput = ({
  placeholder,
  value,
  onChangeText,
  multiline,
  style,
}: {
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  style?: any;
}) => {
  const { TextInput } = require('react-native');
  return (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={C.textMuted}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      style={[styles.darkInput, style]}
    />
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: C.accentTranslucent,
    borderColor: C.accentBorder,
    borderWidth: 1,
    borderRadius: R.nano,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  viewAll: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: C.accent,
    borderRadius: R.sm,
    paddingHorizontal: 20,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: C.bg,
    fontWeight: '700',
    fontSize: 14,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.sm,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    color: C.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.sm,
    padding: 16,
  },
  darkInput: {
    backgroundColor: C.inputBg,
    color: C.textPrimary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});
