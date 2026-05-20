import { Pressable, Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
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
        height: 48,
        backgroundColor: "rgba(250,248,244,0.94)",
        borderBottomColor: "transparent",
        borderBottomWidth: 1,
      }}
    >
      <Pressable
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ChevronLeft size={22} color={colors.navy} strokeWidth={2} />
      </Pressable>

      {title ? (
        <Text
          className="text-navy"
          style={{ fontFamily: FONT.semibold, fontSize: 16, letterSpacing: -0.16 }}
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : (
        <View />
      )}

      <View style={{ minWidth: 40, alignItems: "flex-end" }}>{rightSlot ?? null}</View>
    </View>
  );
}
