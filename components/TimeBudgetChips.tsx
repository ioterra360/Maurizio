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
        padding: 16,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <Text
        className="mb-3 text-body text-mid-grey"
        style={{ fontFamily: FONT.medium }}
      >
        How long do you have today?
      </Text>
      <View className="flex-row" style={{ gap: 6 }}>
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
                height: 36,
                backgroundColor: on ? colors.navy : "transparent",
                borderWidth: on ? 0 : 1,
                borderColor: colors.hairlineStrong,
                opacity: pressed && !on ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: on ? FONT.semibold : FONT.medium,
                  fontSize: 13,
                  color: on ? "#fff" : colors.navy,
                  letterSpacing: -0.07,
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
