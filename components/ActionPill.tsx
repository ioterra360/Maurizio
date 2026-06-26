import { Text } from "react-native";
import { type LucideIcon } from "lucide-react-native";
import { Tappable } from "@/components/Tappable";
import { FONT, colors, radii } from "@/theme/tokens";

type Props = {
  icon: LucideIcon;
  label: string;
  /** Tint for the icon. */
  color?: string;
  onPress?: () => void;
};

/**
 * "Review now" / "Add item" quick-action buttons in the Folder detail header.
 * Tonal pill with icon + label.
 */
export function ActionPill({ icon: Icon, label, color = colors.navy, onPress }: Props) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      containerStyle={{ flex: 1 }}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.chip,
        backgroundColor: colors.surface,
        height: 44,
        gap: 10,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <Icon size={18} color={color} strokeWidth={2} />
      <Text
        style={{ fontFamily: FONT.semibold, fontSize: 15, color: colors.navy, letterSpacing: -0.1 }}
      >
        {label}
      </Text>
    </Tappable>
  );
}
