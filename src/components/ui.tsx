import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { nice } from '@/engine/dates';
import { radius, space, useColors } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Variant = 'title' | 'heading' | 'body' | 'label' | 'caption' | 'number';

const variants: Record<Variant, TextStyle> = {
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  caption: { fontSize: 12, lineHeight: 16 },
  number: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

export function Text({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const c = useColors();
  return <RNText style={[variants[variant], { color: color ?? (muted ? c.muted : c.text) }, style]} {...rest} />;
}

/** Scrollable page with a max width so it reads well on desktop web too. */
export function Screen({
  children,
  title,
  subtitle,
  right,
  back,
  intro,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  /** Show a back button (screens opened from More). */
  back?: boolean;
  /** One-paragraph explanation under the title. */
  intro?: string;
}) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/more'))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: space.md }}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={20} color={c.primary} />
              <Text variant="label" color={c.primary}>Back</Text>
            </Pressable>
          ) : null}
          {title ? (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                {subtitle ? <Text variant="label" muted>{subtitle.toUpperCase()}</Text> : null}
                <Text variant="title">{title}</Text>
              </View>
              {right}
            </View>
          ) : null}
          {intro ? (
            <Text muted style={{ marginBottom: space.md, maxWidth: 620 }}>
              {intro}
            </Text>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'warning' | 'danger' | 'primary' }) {
  const c = useColors();
  const bg = tone === 'warning' ? c.warningSoft : tone === 'danger' ? c.dangerSoft : tone === 'primary' ? c.primarySoft : c.surface;
  return <View style={[styles.card, { backgroundColor: bg, borderColor: tone ? 'transparent' : c.border }, style]}>{children}</View>;
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ marginTop: space.xl }}>
      <View style={styles.sectionHead}>
        <Text variant="heading">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  small,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  small?: boolean;
}) {
  const c = useColors();
  const bg = kind === 'primary' ? c.primary : kind === 'secondary' ? c.surfaceAlt : 'transparent';
  const fg = kind === 'primary' ? c.primaryText : kind === 'danger' ? c.danger : kind === 'ghost' ? c.primary : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text variant="label" color={fg} style={{ fontSize: small ? 13 : 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  numeric,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  numeric?: boolean;
  hint?: string;
}) {
  const c = useColors();
  return (
    <View style={{ marginBottom: space.md, flex: 1, minWidth: 140 }}>
      <Text variant="label" muted style={{ marginBottom: space.xs }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
      />
      {hint ? <Text variant="caption" muted style={{ marginTop: 2 }}>{hint}</Text> : null}
    </View>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.chip, { backgroundColor: on ? c.primary : c.surface, borderColor: on ? c.primary : c.border }]}
          >
            <Text variant="caption" color={on ? c.primaryText : c.text} style={{ fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 130 }}>
      <Text variant="caption" muted>{label}</Text>
      <Text variant="number" color={color}>{value}</Text>
      {sub ? <Text variant="caption" muted>{sub}</Text> : null}
    </View>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color ?? c.primary, borderRadius: radius.pill }} />
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: color }} />;
}

export function Pill({ label, tone }: { label: string; tone?: 'good' | 'warn' | 'note' }) {
  const c = useColors();
  const bg = tone === 'good' ? c.primarySoft : tone === 'warn' ? c.dangerSoft : tone === 'note' ? c.warningSoft : c.surfaceAlt;
  const fg = tone === 'good' ? c.positive : tone === 'warn' ? c.danger : tone === 'note' ? c.warning : c.muted;
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: bg, alignSelf: 'flex-start' }}>
      <Text variant="caption" color={fg} style={{ fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

/** "Estimated" when a number assumes the plan happened; "Confirmed Nov 1" when the user said so. */
export function EstTag({ est, conf }: { est: boolean; conf?: string | null }) {
  const c = useColors();
  if (est) {
    return (
      <View
        accessibilityLabel="Estimated: based on your plan, not confirmed"
        style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: c.warning, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, alignSelf: 'flex-start' }}
      >
        <Text variant="caption" color={c.warning} style={{ fontWeight: '700' }}>
          Estimated
        </Text>
      </View>
    );
  }
  return conf ? <Pill tone="good" label={`Confirmed ${nice(conf)}`} /> : null;
}

export function Callout({ children, tone = 'note', action }: { children: ReactNode; tone?: 'note' | 'good' | 'warn'; action?: ReactNode }) {
  const c = useColors();
  const bg = tone === 'good' ? c.primarySoft : tone === 'warn' ? c.dangerSoft : c.warningSoft;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, gap: space.md }}>
      <View>{children}</View>
      {action}
    </View>
  );
}

export function Label({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <Text variant="caption" muted={!color} color={color} style={{ fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: space.sm }} />;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 48 },
  inner: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: space.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: space.lg, paddingBottom: space.sm, gap: space.md },
  card: { borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: 13,
    borderRadius: radius.md,
  },
  buttonSmall: { paddingHorizontal: space.md, paddingVertical: 7 },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
});
