import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { X } from "lucide-react-native";

import { Mascot } from "./Mascot";
import { FONT, colors } from "@/theme/tokens";
import type { CoachTip as Tip } from "@/lib/coach-tips";

const DISMISSED_KEY_PREFIX = "memora.coachtip.dismissed.";

type Props = {
  tip: Tip;
  /** If provided, the tip is persistently dismissed and won't render again. */
  persistDismiss?: boolean;
  /** Optional accent color band on the mascot circle (defaults to navy). */
  accent?: string;
};

/**
 * A speech-bubble tip from the Memora coach mascot. The bubble sits
 * alongside the mascot avatar and shows a short title + body + optional
 * source citation. A close button persists the dismissal so the same tip
 * doesn't re-appear (unless persistDismiss is false).
 */
export function CoachTip({ tip, persistDismiss = true, accent = colors.navy }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(!persistDismiss);

  useEffect(() => {
    if (!persistDismiss) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(DISMISSED_KEY_PREFIX + tip.id);
        if (!cancelled) {
          setDismissed(seen === "1");
          setChecked(true);
        }
      } catch {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tip.id, persistDismiss]);

  if (!checked || dismissed) return null;

  const close = async () => {
    setDismissed(true);
    if (persistDismiss) {
      try {
        await AsyncStorage.setItem(DISMISSED_KEY_PREFIX + tip.id, "1");
      } catch {
        // ignore: tip will reappear next session, no big deal
      }
    }
  };

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 14,
        paddingRight: 12,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
        shadowColor: colors.navy,
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 18,
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          backgroundColor: colors.warmWhite,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: accent,
        }}
      >
        <Mascot size={36} withShadow={false} />
      </View>

      <View style={{ flex: 1, paddingTop: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              flex: 1,
              fontFamily: FONT.semibold,
              fontSize: 13.5,
              color: colors.navy,
              letterSpacing: -0.1,
            }}
          >
            {tip.title}
          </Text>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Chiudi suggerimento"
            hitSlop={8}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 0.7,
              marginTop: -2,
            })}
          >
            <X size={16} color={colors.midGrey} strokeWidth={2} />
          </Pressable>
        </View>
        <Text
          style={{
            marginTop: 4,
            fontFamily: FONT.regular,
            fontSize: 12.5,
            lineHeight: 18,
            color: colors.midGrey,
          }}
        >
          {tip.body}
        </Text>
        {tip.source ? (
          <Text
            style={{
              marginTop: 6,
              fontFamily: FONT.medium,
              fontSize: 10.5,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: colors.placeholder,
            }}
          >
            {tip.source}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
