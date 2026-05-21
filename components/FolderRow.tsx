import { Pressable, Text, View } from "react-native";
import { ChevronUp, ChevronDown } from "lucide-react-native";
import { FONT, colors } from "@/theme/tokens";
import { FolderTile } from "./FolderTile";
import { RetentionBar } from "./RetentionBar";
import type { FolderKind } from "@/lib/constants";

type Props = {
  kind: FolderKind;
  name: string;
  priority: number;
  count: number;
  active: number;
  fading: number;
  archived: number;
  onPress?: () => void;
  /** When provided, shows reorder controls. Disable arrows at list edges. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

/**
 * A folder line item in the Knowledge screen: tile + name + priority chip
 * + sub-line + retention bar + reorder arrows. Card has a soft drop shadow
 * to stand off the warm-white canvas.
 */
export function FolderRow({
  kind,
  name,
  priority,
  count,
  active,
  fading,
  archived,
  onPress,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: Props) {
  const showReorder = !!(onMoveUp || onMoveDown);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} folder, priority ${priority}, ${count} items`}
      className="flex-row items-center rounded-card bg-surface"
      style={({ pressed }) => ({
        paddingVertical: 18,
        paddingLeft: 16,
        paddingRight: showReorder ? 6 : 14,
        gap: 14,
        borderWidth: 1,
        borderColor: colors.hairline,
        opacity: pressed ? 0.92 : 1,
        // Soft elevated shadow to separate the card from the warm-white
        // canvas behind it. Subtle enough to keep the editorial calm look.
        shadowColor: colors.navy,
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 18,
        elevation: 2,
      })}
    >
      <FolderTile kind={kind} />

      <View className="flex-1" style={{ minWidth: 0 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text
            className="text-navy"
            style={{ fontFamily: FONT.semibold, fontSize: 15, letterSpacing: -0.15 }}
          >
            {name}
          </Text>
          <View
            className="rounded-tag"
            style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: colors.divider }}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 11,
                color: colors.midGrey,
                letterSpacing: 0.2,
                fontVariant: ["tabular-nums"],
              }}
            >
              #{priority}
            </Text>
          </View>
        </View>
        <Text
          className="mt-1 text-caption text-mid-grey"
          style={{
            fontFamily: FONT.regular,
            fontVariant: ["tabular-nums"],
          }}
        >
          {count} items · {active}% active
        </Text>
      </View>

      <RetentionBar active={active} fading={fading} archived={archived} width={64} height={6} />

      {showReorder ? (
        <View style={{ marginLeft: 4, flexDirection: "column", gap: 2 }}>
          <ReorderButton
            direction="up"
            disabled={!canMoveUp}
            onPress={onMoveUp}
          />
          <ReorderButton
            direction="down"
            disabled={!canMoveDown}
            onPress={onMoveDown}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function ReorderButton({
  direction,
  onPress,
  disabled,
}: {
  direction: "up" | "down";
  onPress?: () => void;
  disabled?: boolean;
}) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  return (
    <Pressable
      onPress={(e) => {
        // Stop the press from propagating to the card's onPress.
        e.stopPropagation();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Sposta ${direction === "up" ? "su" : "giù"}`}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 32,
        height: 22,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: disabled ? "transparent" : colors.tagUserBg,
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
      })}
    >
      <Icon size={16} color={colors.navy} strokeWidth={2} />
    </Pressable>
  );
}
