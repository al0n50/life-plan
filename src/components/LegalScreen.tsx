import { Screen, Section, Text } from '@/components/ui';
import type { LegalDoc } from '@/content/legal';
import { space } from '@/theme';

/** Renders a privacy policy or terms document from src/content/legal.ts. */
export function LegalScreen({ doc }: { doc: LegalDoc }) {
  return (
    <Screen back title={doc.title} intro={doc.intro}>
      <Text variant="caption" muted>Last updated {doc.updated}</Text>
      {doc.sections.map((s) => (
        <Section key={s.heading} title={s.heading}>
          {s.body.map((p) => (
            <Text key={p} style={{ marginBottom: space.sm }}>{p}</Text>
          ))}
        </Section>
      ))}
    </Screen>
  );
}
