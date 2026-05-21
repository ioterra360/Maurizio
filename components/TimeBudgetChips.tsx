import { Pressable, Text, View } from "react-native";
import { Clock3, Coffee, BookOpen, Flame } from "lucide-react-native";
import { FONT, colors } from "@/theme/tokens";
import { TIME_BUDGETS } from "@/lib/constants";

type Props = {
  value: number;
  onChange: (minutes: number) => void;
};

const ICONS = {
  5: Clock3,
  15: Coffee,
  30: BookOpen,
  60: Flame,
} as const;

/**
 * The "Quanto tempo hai oggi?" selector on the Today screen.
 * Four large buttons laid out in a 2×2 grid; the active one is navy-filled
 * with white text, others are surface-white with a hairline border and
 * navy text. Each card shows minutes, mood label and est. item count.
 */
export function TimeBudgetChips({ value, onChange }: Props) {
  return (
    <View
      className="rounded-card bg-surface"
      style={{
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 18,
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
          marginBottom: 14,
        }}
      >
        Quanto tempo hai oggi?
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {TIME_BUDGETS.map((b) => {
          const on = value === b.minutes;
          const Icon = ICONS[b.minutes as keyof typeof ICONS] ?? Clock3;
          return (
            <Pressable
              key={b.minutes}
              onPress={() => onChange(b.minutes)}
              accessibilityRole="button"
              accessibilityLabel={`Imposta tempo di studio a ${b.label}`}
              accessibilityState={{ selected: on }}
              className="rounded-chip"
              style={({ pressed }) => ({
                // 2 per row: (containerWidth - gap) / 2
                // We rely on flexBasis to keep it responsive across widths.
                flexBasis: "48%",
                flexGrow: 1,
                paddingVertical: 16,
                paddingHorizontal: 14,
                backgroundColor: on ? colors.navy : colors.warmWhite,
                borderWidth: on ? 0 : 1,
                borderColor: colors.hairline,
                opacity: pressed && !on ? 0.75 : 1,
                shadowColor: on ? colors.navy : "transparent",
                shadowOpacity: on ? 0.22 : 0,
                shadowOffset: { width: 0, height: 6 },
                shadowRadius: 14,
                elevation: on ? 3 : 0,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={1.75}
                  color={on ? "#fff" : colors.navy}
                />
                {on && (
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.18)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        backgroundColor: "#fff",
                      }}
                    />
                  </View>
                )}
              </View>
              <Text
                style={{
                  marginTop: 12,
                  fontFamily: FONT.bold,
                  fontSize: 18,
                  color: on ? "#fff" : colors.navy,
                  letterSpacing: -0.3,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {b.label}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: FONT.semibold,
                  fontSize: 11,
                  color: on ? "rgba(255,255,255,0.78)" : colors.midGrey,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {b.sublabel}
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  fontFamily: FONT.medium,
                  fontSize: 11.5,
                  color: on ? "rgba(255,255,255,0.7)" : colors.midGrey,
                  fontVariant: ["tabular-nums"],
                }}
              >
                ≈ {b.estItems} ricordi
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
