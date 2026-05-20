import { Pressable, Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";
import { TIME_BUDGETS } from "@/lib/constants";

type Props = {
  value: number;
  onChange: (minutes: number) => void;
};

/**
 * The "How long do you have today?" chip row on the Today screen.
 * 5 / 15 / 30 / 1 hr. The active chip is navy filled; others are
 * hairline-bordered transparent.
 */
export function TimeBudgetChips({ value, onChange }: Props) {
  return (
    <View
      className="rounded-card bg-surface"
      style={{
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 20,
        borderWidth: 1,
        borderColor: colors.hairline,
        shadowColor: colors.navy,
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 16,
        elevation: 1,
      }}
    >
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 11,
          color: colors.midGrey,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        How long do you have today?
      </Text>
      <View className="flex-row" style={{ gap: 10 }}>
        {TIME_BUDGETS.map((b) => {
          const on = value === b.minutes;
          return (
            <Pressable
              key={b.minutes}
              onPress={() => onChange(b.minutes)}
              accessibilityRole="button"
              accessibilityLabel={`Set time budget to ${b.label}`}
              accessibilityState={{ selected: on }}
              className="flex-1 items-center justify-center rounded-chip"
              style={({ pressed }) => ({
                paddingVertical: 14,
                backgroundColor: on ? colors.navy : "#FBFAF6",
                borderWidth: on ? 0 : 1,
                borderColor: colors.hairline,
                opacity: pressed && !on ? 0.7 : 1,
                shadowColor: on ? colors.navy : "transparent",
                shadowOpacity: on ? 0.18 : 0,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 10,
                elevation: on ? 2 : 0,
              })}
            >
              <Text
                style={{
                  fontFamily: on ? FONT.bold : FONT.semibold,
                  fontSize: 15,
                  color: on ? "#fff" : colors.navy,
                  letterSpacing: -0.2,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {b.label}
              </Text>
              <Text
                style={{
                  marginTop: 3,
                  fontFamily: FONT.medium,
                  fontSize: 10.5,
                  color: on ? "rgba(255,255,255,0.7)" : colors.midGrey,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {b.estItems} items
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
