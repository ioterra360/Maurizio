import { Pressable, Text, View } from "react-native";
import { Clock3, Coffee, BookOpen, Flame, Check } from "lucide-react-native";
import { FONT, colors } from "@/theme/tokens";
import { TIME_BUDGETS } from "@/lib/constants";
import { tap } from "@/lib/feedback";

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
 * "Quanto tempo hai oggi?" — four large buttons laid out in a 2×2 grid.
 * Active chip: warm-tint background, navy border 2px + bold navy text +
 * a navy check pip. Inactive: warm-white with hairline. No white text
 * anywhere.
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
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 20,
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 12,
          color: colors.midGrey,
          letterSpacing: 1.2,
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
              onPress={() => {
                tap();
                onChange(b.minutes);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Imposta tempo di studio a ${b.label}`}
              accessibilityState={{ selected: on }}
              className="rounded-chip"
              style={({ pressed }) => ({
                width: "48%",
                paddingVertical: 16,
                paddingHorizontal: 14,
                backgroundColor: on ? colors.tagUserBg : colors.warmWhite,
                borderWidth: on ? 2 : 1,
                borderColor: on ? colors.navy : colors.hairline,
                opacity: pressed && !on ? 0.75 : 1,
                shadowColor: on ? colors.navy : "transparent",
                shadowOpacity: on ? 0.18 : 0,
                shadowOffset: { width: 0, height: 6 },
                shadowRadius: 12,
                elevation: on ? 2 : 0,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Icon size={20} strokeWidth={1.75} color={colors.navy} />
                {on ? (
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      backgroundColor: colors.navy,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={12} color={colors.warmWhite} strokeWidth={3} />
                  </View>
                ) : null}
              </View>
              <Text
                style={{
                  marginTop: 14,
                  fontFamily: FONT.bold,
                  fontSize: 20,
                  color: colors.navy,
                  letterSpacing: -0.4,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {b.label}
              </Text>
              <Text
                style={{
                  marginTop: 3,
                  fontFamily: FONT.semibold,
                  fontSize: 11.5,
                  color: colors.midGrey,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {b.sublabel}
              </Text>
              <Text
                style={{
                  marginTop: 10,
                  fontFamily: FONT.medium,
                  fontSize: 12.5,
                  color: colors.midGrey,
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
