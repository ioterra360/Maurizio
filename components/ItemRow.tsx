import { Text, View, useWindowDimensions } from "react-native";
import { Tappable } from "@/components/Tappable";
import { FONT, radii, useThemeTokens } from "@/theme/tokens";
import { useT } from "@/lib/i18n";
import { lineFontSize } from "@/lib/term-typography";
import type { FolderItem } from "@/lib/folder-data";

// CJK detection: Hiragana (3040-309F), Katakana (30A0-30FF), CJK Unified
// (4E00-9FFF), and ideographic space (3000). Covers Japanese contents in
// the seed folders.
const isCjk = (s: string) =>
  /[　-ヿ一-鿿]/.test(s);

type Props = {
  item: FolderItem;
  /** Opens the memory detail sheet. Rows without it render as plain cards. */
  onPress?: () => void;
};

/**
 * One memory line in the Folder detail list. State dot on the left,
 * term (+ reading) + last-reviewed, and a state chip on the right. The
 * meaning is deliberately NOT shown here — only inside the detail sheet
 * (Angelo, 2026-08-27), so the list itself works as a self-test.
 */
export function ItemRow({ item, onPress }: Props) {
  const { t } = useT();
  const { colors, statusTint } = useThemeTokens();
  const { width } = useWindowDimensions();
  // Labels are catalog KEYS, resolved with t() at render so the runtime
  // language switch applies at once. Dentro il componente perché dot/tint
  // seguono il tema corrente (una costante di modulo si congela al boot).
  const STATE_META = {
    active:   { dot: colors.active,   ...statusTint.active,   labelKey: "itemRow.stateStable" },
    fading:   { dot: colors.fading,   ...statusTint.fading,   labelKey: "itemRow.stateFading" },
    archived: { dot: colors.archived, ...statusTint.archived, labelKey: "itemRow.stateArchived" },
  } as const;
  const meta = STATE_META[item.state];
  const cjk = isCjk(item.front);
  // Il termine si RIMPICCIOLISCE per stare intero sulla riga (fino a 12 px)
  // prima che i puntini possano tagliarlo — Maurizio 2026-08-30 ("embarg…").
  // Box stimato: schermo − padding lista/riga − pallino − chip di stato.
  const termSize = lineFontSize(item.front, width - 180, cjk ? 17 : 15, 12);

  return (
    <Tappable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={t("itemRow.a11yOpen", { front: item.front })}
      pressedOpacity={0.85}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        borderRadius: radii.input,
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
        paddingVertical: 13,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: meta.dot,
          marginTop: 7,
        }}
      />

      <View className="flex-1" style={{ minWidth: 0 }}>
        <View className="flex-row flex-wrap items-baseline" style={{ gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FONT.semibold,
              fontSize: termSize,
              color: colors.navy,
              letterSpacing: -0.1,
              flexShrink: 1,
            }}
          >
            {item.front}
          </Text>
          {item.reading ? (
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 12,
                color: colors.midGrey,
                letterSpacing: 0.1,
              }}
            >
              {item.reading}
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 11.5,
            color: colors.placeholder,
            marginTop: 5,
            fontVariant: ["tabular-nums"],
          }}
        >
          {t("itemRow.reviewed", { reviewed: item.reviewed })}
        </Text>
      </View>

      <View
        className="rounded-tag"
        style={{
          backgroundColor: meta.bg,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text
          style={{
            fontFamily: FONT.semibold,
            fontSize: 11,
            color: meta.text,
            letterSpacing: 0.2,
          }}
        >
          {t(meta.labelKey)}
        </Text>
      </View>
    </Tappable>
  );
}
