import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Tappable } from "@/components/Tappable";
import { useT } from "@/lib/i18n";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  /** One honest sentence about what did not load. */
  title: string;
  /** Default: t("errorCard.defaultHint") — "Controlla la connessione e riprova." */
  hint?: string;
  /** Default: t("common.retry") — "Riprova". */
  actionLabel?: string;
  onRetry?: () => void;
  /** While a retry is in flight the button is disabled and reads t("errorCard.retrying"). */
  retrying?: boolean;
  /** Accessibility label for the retry button — say WHAT is retried. */
  retryAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Inline error state with a retry — the same card Knowledge shows when the
 * folder list fails. Used by Today (plan), Health (ring / cognitive load)
 * and the review screens (deck load). Never renders fake numbers: the
 * caller swaps the failed section for this card.
 */
export function ErrorCard({
  title,
  hint: hintProp,
  actionLabel: actionLabelProp,
  onRetry,
  retrying = false,
  retryAccessibilityLabel,
  style,
}: Props) {
  const { t } = useT();
  // Defaults resolve at render so the Settings language switch applies at once.
  const hint = hintProp ?? t("errorCard.defaultHint");
  const actionLabel = actionLabelProp ?? t("common.retry");
  return (
    <View
      className="rounded-card bg-surface"
      accessibilityRole="alert"
      style={[
        {
          padding: 18,
          borderWidth: 1,
          borderColor: colors.hairline,
          alignItems: "center",
          gap: 10,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 15,
          color: colors.navy,
          textAlign: "center",
          lineHeight: 21,
        }}
      >
        {title}
      </Text>
      {hint ? (
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 13.5,
            color: colors.midGrey,
            textAlign: "center",
            lineHeight: 19,
          }}
        >
          {hint}
        </Text>
      ) : null}
      {onRetry ? (
        <Tappable
          onPress={onRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel={retryAccessibilityLabel ?? actionLabel}
          accessibilityState={{ disabled: retrying, busy: retrying }}
          containerStyle={{ marginTop: 4 }}
          style={{
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: colors.warmWhite,
            borderWidth: 1.5,
            borderColor: colors.navy,
            opacity: retrying ? 0.6 : 1,
          }}
        >
          <Text style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}>
            {retrying ? t("errorCard.retrying") : actionLabel}
          </Text>
        </Tappable>
      ) : null}
    </View>
  );
}
