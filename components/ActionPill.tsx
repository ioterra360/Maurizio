import { Pressable, Text, View } from "react-native";
import { type LucideIcon } from "lucide-react-native";
import { FONT, colors } from "@/theme/tokens";

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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-1 flex-row items-center justify-center rounded-chip bg-surface"
      style={({ pressed }) => ({
        height: 50,
        gap: 10,
        borderWidth: 1.2,
        borderColor: colors.hairlineStrong,
        opacity: pressed ? 0.85 : 1,
        shadowColor: colors.navy,
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 1,
      })}
    >
      <Icon size={18} color={color} strokeWidth={2} />
      <Text
        className="text-navy"
        style={{ fontFamily: FONT.semibold, fontSize: 15, letterSpacing: -0.1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
