import { Pressable, Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { router } from "expo-router";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  /**
   * When set, renders a "← Back" affordance above the title.
   * Pass a callback to override the default (router.back()).
   */
  onBack?: (() => void) | true;
};

/**
 * The big header for the admin tab screens — title with inline ADMIN
 * pill + sub-line, optional right slot, optional back affordance for
 * sub-pages drilled into from the More tab.
 */
export function AdminTopBar({ title, subtitle, rightSlot, onBack }: Props) {
  const handleBack = () => {
    if (typeof onBack === "function") onBack();
    else if (router.canGoBack()) router.back();
  };

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: onBack ? 4 : 10,
        paddingBottom: 14,
      }}
    >
      {onBack ? (
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="flex-row items-center"
          style={({ pressed }) => ({
            paddingVertical: 4,
            marginLeft: -4,
            marginBottom: 4,
            gap: 4,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <ChevronLeft size={18} color={colors.midGrey} strokeWidth={2} />
          <Text style={{ fontFamily: FONT.medium, fontSize: 13, color: colors.midGrey }}>
            Back
          </Text>
        </Pressable>
      ) : null}

      <View
        className="flex-row items-end justify-between"
        style={{ gap: 12, paddingHorizontal: onBack ? 6 : 6 }}
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
                  letterSpacing: 0.95, // 0.1em on 9.5px
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
