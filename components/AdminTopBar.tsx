import { Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { Tappable } from "@/components/Tappable";
import { FONT, useColors } from "@/theme/tokens";
import { safeBack } from "@/lib/safe-back";
import { useT } from "@/lib/i18n";

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
  const { t } = useT();
  const colors = useColors();
  const handleBack = () => {
    if (typeof onBack === "function") onBack();
    else safeBack();
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
        <Tappable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          pressedOpacity={0.5}
          containerStyle={{ marginLeft: -4, marginBottom: 4 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 4,
            gap: 4,
          }}
        >
          <ChevronLeft size={18} color={colors.midGrey} strokeWidth={2} />
          <Text style={{ fontFamily: FONT.medium, fontSize: 14, color: colors.midGrey }}>
            Indietro
          </Text>
        </Tappable>
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
                  fontSize: 10.5,
                  color: colors.warmWhite,
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
                fontSize: 13.5,
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
