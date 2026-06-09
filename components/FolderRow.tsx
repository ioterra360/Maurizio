import { Pressable, Text, View } from "react-native";
import { GripVertical } from "lucide-react-native";
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
  /**
   * Drag-to-reorder activator (from DraggableFlatList's renderItem). When
   * provided, the GripVertical handle on the right starts a drag on long
   * press — matching the design contract's drag affordance.
   */
  onDrag?: () => void;
  /** True while this row is the one being dragged — lifts it off the canvas. */
  isActive?: boolean;
};

/**
 * Knowledge-tab folder row. Mirrors screens.jsx:113 — surface bg, 1px
 * hairline border, `padding: 12 12 12 14`, gap 12, drag-handle icon on the
 * right. A very subtle elevation keeps the card from looking pasted-on the
 * warm-white canvas without breaking the editorial-flat feel.
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
  onDrag,
  isActive,
}: Props) {
  const showReorder = !!onDrag;

  return (
    <Pressable
      onPress={onPress}
      disabled={isActive}
      accessibilityRole="button"
      accessibilityLabel={`${name}, priorità ${priority}, ${count} ricordi`}
      accessibilityHint={showReorder ? "Tieni premuta la maniglia per riordinare" : undefined}
      className="flex-row items-center rounded-card bg-surface"
      style={({ pressed }) => ({
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: 14,
        paddingRight: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: isActive ? colors.hairlineStrong : colors.hairline,
        opacity: pressed && !isActive ? 0.94 : 1,
        // Subtle baseline elevation — keeps the card readable on the warm
        // canvas. While dragging, the card lifts with a stronger shadow so it
        // visibly floats above the list.
        shadowColor: colors.navy,
        shadowOpacity: isActive ? 0.18 : 0.04,
        shadowOffset: { width: 0, height: isActive ? 8 : 1 },
        shadowRadius: isActive ? 16 : 2,
        elevation: isActive ? 8 : 1,
        transform: [{ scale: isActive ? 1.02 : 1 }],
      })}
    >
      <FolderTile kind={kind} />

      <View className="flex-1" style={{ minWidth: 0 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FONT.semibold,
              fontSize: 15,
              color: colors.navy,
              letterSpacing: -0.15,
              flexShrink: 1,
            }}
          >
            {name}
          </Text>
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 7,
              backgroundColor: colors.divider,
              flexShrink: 0,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 11,
                color: colors.midGrey,
                letterSpacing: 0.1,
                fontVariant: ["tabular-nums"],
              }}
            >
              #{priority}
            </Text>
          </View>
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: FONT.regular,
            fontSize: 12.5,
            color: colors.midGrey,
            marginTop: 3,
            fontVariant: ["tabular-nums"],
          }}
        >
          {count} ricordi · {active}% attivi
        </Text>
      </View>

      <RetentionBar active={active} fading={fading} archived={archived} width={72} height={6} />

      {showReorder ? (
        <Pressable
          onLongPress={onDrag}
          delayLongPress={140}
          accessibilityRole="button"
          accessibilityLabel="Trascina per riordinare"
          hitSlop={10}
          style={({ pressed }) => ({
            marginLeft: 2,
            padding: 4,
            opacity: pressed || isActive ? 0.55 : 1,
          })}
        >
          <GripVertical size={16} color={colors.archived} strokeWidth={1.75} />
        </Pressable>
      ) : (
        <GripVertical size={16} color={colors.archived} strokeWidth={1.75} />
      )}
    </Pressable>
  );
}
