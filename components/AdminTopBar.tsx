import { Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
};

/**
 * The big header for the five admin tab screens — title with inline ADMIN
 * pill + sub-line, optional right slot for an alerts icon or filter.
 */
export function AdminTopBar({ title, subtitle, rightSlot }: Props) {
  return (
    <View
      style={{
        paddingHorizontal: 22,
        paddingTop: 10,
        paddingBottom: 12,
      }}
    >
      <View
        className="flex-row items-end justify-between"
        style={{ gap: 12 }}
      >
        <View className="flex-1" style={{ minWidth: 0 }}>
          <View
            className="flex-row items-center"
            style={{ gap: 8, flexWrap: "wrap" }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: FONT.bold,
                fontSize: 26,
                color: colors.navy,
                letterSpacing: -0.65,
                lineHeight: 29,
              }}
            >
              {title}
            </Text>
            <View
              style={{
                backgroundColor: colors.navy,
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.bold,
                  fontSize: 9.5,
                  color: "#fff",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Admin
              </Text>
            </View>
          </View>
          {subtitle ? (
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 12.5,
                color: colors.midGrey,
                marginTop: 4,
                fontVariant: ["tabular-nums"],
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightSlot ? <View>{rightSlot}</View> : null}
      </View>
    </View>
  );
}
