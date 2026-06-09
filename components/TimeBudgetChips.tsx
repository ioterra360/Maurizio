import { Pressable, Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";
import { TIME_BUDGETS } from "@/lib/constants";
import { tap } from "@/lib/feedback";

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
            <Pressable
              key={b.minutes}
              onPress={() => {
                tap();
                onChange(b.minutes);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Imposta tempo di studio a ${b.label}`}
              accessibilityState={{ selected: on }}
              hitSlop={6}
              className="rounded-chip"
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 8,
                backgroundColor: on ? colors.navy : colors.surface,
                borderWidth: on ? 0 : 1,
                borderColor: colors.hairline,
                opacity: pressed && !on ? 0.7 : 1,
              })}
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
