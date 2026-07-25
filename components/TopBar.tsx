import { Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { Tappable } from "@/components/Tappable";
import { FONT, colors } from "@/theme/tokens";
import { safeBack } from "@/lib/safe-back";

type Props = {
  title?: string;
  onBack?: () => void;
  /** Optional right-aligned element (text button, icon, etc.). */
  rightSlot?: React.ReactNode;
};

/**
 * Modal-style top bar: back chevron on the left, optional centered title,
 * optional right slot. Used on Add to memory and Folder detail.
 *
 * Default back behavior goes through safeBack so the keyboard is dismissed
 * before navigation — see lib/safe-back.ts for the Android race this fixes.
 */
export function TopBar({ title, onBack, rightSlot }: Props) {
  const handleBack = () => {
    if (onBack) onBack();
    else safeBack();
  };
  return (
    <View
      className="flex-row items-center justify-between"
      style={{
        paddingLeft: 14,
        paddingRight: 18,
        paddingVertical: 8,
        minHeight: 48,
        backgroundColor: "rgba(250,248,244,0.94)",
        borderBottomColor: "transparent",
        borderBottomWidth: 1,
      }}
    >
      <Tappable
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel="Indietro"
        pressedOpacity={0.6}
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronLeft size={22} color={colors.navy} strokeWidth={2} />
      </Tappable>

      {title ? (
        <Text
          className="text-navy"
          style={{
            flex: 1,
            textAlign: "center",
            marginHorizontal: 8,
            fontFamily: FONT.semibold,
            fontSize: 16,
            letterSpacing: -0.16,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View style={{ minWidth: 40, flexShrink: 0, alignItems: "flex-end" }}>{rightSlot ?? null}</View>
    </View>
  );
}
