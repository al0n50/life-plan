import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Screen, Text, type IconName } from '@/components/ui';
import { radius, space, useColors } from '@/theme';

const ITEMS: { href: Href; title: string; sub: string; icon: IconName }[] = [
  { href: '/paycheck', title: 'Paycheck', sub: 'Your next paycheck and where it goes', icon: 'cash-outline' },
  { href: '/accounts', title: 'Accounts', sub: 'Checking, savings, HYSA, investing, and routing', icon: 'wallet-outline' },
  { href: '/income', title: 'Income', sub: 'Jobs, hours, future income, and your pay stub', icon: 'briefcase-outline' },
  { href: '/expenses', title: 'Expenses', sub: 'Bills and everyday spending', icon: 'receipt-outline' },
  { href: '/debt', title: 'Debt', sub: 'Balances, rates, and your approach', icon: 'card-outline' },
  { href: '/goals', title: 'Goals', sub: 'Your emergency fund and big goals', icon: 'trophy-outline' },
  { href: '/plan', title: 'Plan', sub: 'How your phases and split work, and settings', icon: 'git-branch-outline' },
  { href: '/review', title: 'Full review', sub: 'Check every balance against your plan', icon: 'clipboard-outline' },
];

export default function More() {
  const c = useColors();
  return (
    <Screen title="More">
      <View style={{ gap: space.sm }}>
        {ITEMS.map((it) => (
          <Pressable
            key={it.title}
            onPress={() => router.push(it.href)}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 })}
          >
            <Ionicons name={it.icon} size={22} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>{it.title}</Text>
              <Text variant="caption" muted>{it.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Pressable>
        ))}
      </View>
      <Text variant="caption" muted style={{ marginTop: space.xl }}>
        Life Plan is an educational planning tool, not financial, tax, or legal advice.
      </Text>
    </Screen>
  );
}
