import { Text, View } from "react-native";
import { Tappable } from "@/components/Tappable";
import { FONT, colors, radii } from "@/theme/tokens";
import { TIME_BUDGETS } from "@/lib/constants";
import { tap } from "@/lib/feedback";
import { useT } from "@/lib/i18n";

type Props = {
  value: number;
  onChange: (minutes: number) => void;
};

/**
 * "Quanto tempo hai oggi?" — a horizontal 4-up chip row of time budgets
 * (5 / 15 / 30 / 1 hr), per the Claude Design contract (screens.jsx:178).
 * Each chip is flex-1 with a 36-pt minimum touch height, navy fill when
 * active, warm-white with hairline border when idle.
 */
export function TimeBudgetChips({ value, onChange }: Props) {
  const { t } = useT();
  return (
    <View>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 11,
          color: colors.midGrey,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Quanto tempo hai oggi?
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {TIME_BUDGETS.map((b) => {
          const on = value === b.minutes;
          return (
            <Tappable
              key={b.minutes}
              onPress={() => {
                tap();
                onChange(b.minutes);
              }}
              accessibilityLabel={t("timeBudgetChips.setA11y", { label: b.label })}
              accessibilityState={{ selected: on }}
              hitSlop={6}
              pressedOpacity={0.7}
              containerStyle={{ flex: 1 }}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.chip,
                paddingHorizontal: 8,
                backgroundColor: on ? colors.navy : colors.surface,
                borderWidth: on ? 0 : 1,
                borderColor: colors.hairline,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: on ? FONT.semibold : FONT.medium,
                  fontSize: 13.5,
                  color: on ? colors.warmWhite : colors.navy,
                  letterSpacing: -0.06,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {b.label}
              </Text>
            </Tappable>
          );
        })}
      </View>
    </View>
  );
}
