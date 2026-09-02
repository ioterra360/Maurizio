import { useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { GripVertical } from "lucide-react-native";
import { FONT, radii, useColors } from "@/theme/tokens";
import { FolderTile } from "./FolderTile";
import { RetentionBar } from "./RetentionBar";
import type { FolderKind } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import { lineFontSize } from "@/lib/term-typography";

type Props = {
  kind: FolderKind;
  /** Glifo della cartella (folders.emoji); se assente vale il kind legacy. */
  emoji?: string;
  name: string;
  priority: number;
  count: number;
  active: number;
  fading: number;
  archived: number;
  /** Cartella in pausa — resa attenuata con badge, esclusa dai ripassi. */
  paused?: boolean;
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
  emoji,
  name,
  priority,
  count,
  active,
  fading,
  archived,
  paused,
  onPress,
  onDrag,
  isActive,
}: Props) {
  const colors = useColors();
  const { t, tp } = useT();
  const { width } = useWindowDimensions();
  // Il nome si rimpicciolisce (fino a 12 px) prima di troncare: box stimato
  // = schermo − padding − tile − badge priorità − barra retention − grip.
  const nameSize = lineFontSize(name, width - 230, 15, 12);
  const showReorder = !!onDrag;
  const [pressed, setPressed] = useState(false);
  const [reorderPressed, setReorderPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={isActive}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={tp(paused ? "folderRow.a11yLabelPaused" : "folderRow.a11yLabel", count, {
        name,
        priority,
      })}
      accessibilityHint={showReorder ? t("folderRow.a11yReorderHint") : undefined}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radii.card,
        backgroundColor: colors.surface,
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: 14,
        paddingRight: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: isActive ? colors.hairlineStrong : colors.hairline,
        opacity: (pressed && !isActive ? 0.94 : 1) * (paused ? 0.55 : 1),
        // Subtle baseline elevation — keeps the card readable on the warm
        // canvas. While dragging, the card lifts with a stronger shadow so it
        // visibly floats above the list.
        // Shadows stay dark in both themes — fixed navy, not the themed alias.
        shadowColor: "#1A2C4F",
        shadowOpacity: isActive ? 0.18 : 0.04,
        shadowOffset: { width: 0, height: isActive ? 8 : 1 },
        shadowRadius: isActive ? 16 : 2,
        elevation: isActive ? 8 : 1,
        transform: [{ scale: isActive ? 1.02 : 1 }],
      }}
    >
      <FolderTile emoji={emoji} kind={kind} />

      <View className="flex-1" style={{ minWidth: 0 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FONT.semibold,
              fontSize: nameSize,
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
              {t("folderRow.priorityBadge", { priority })}
            </Text>
          </View>
          {paused ? (
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
                  fontSize: 10,
                  color: colors.midGrey,
                  letterSpacing: 0.2,
                }}
              >
                {t("folderRow.pausedBadge")}
              </Text>
            </View>
          ) : null}
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
          {tp("folderRow.summary", count, { active })}
        </Text>
      </View>

      <RetentionBar active={active} fading={fading} archived={archived} width={72} height={6} />

      {showReorder ? (
        <Pressable
          onLongPress={onDrag}
          delayLongPress={140}
          onPressIn={() => setReorderPressed(true)}
          onPressOut={() => setReorderPressed(false)}
          accessibilityRole="button"
          accessibilityLabel={t("folderRow.a11yDragHandle")}
          hitSlop={10}
          style={{
            marginLeft: 2,
            padding: 4,
            opacity: reorderPressed || isActive ? 0.55 : 1,
          }}
        >
          <GripVertical size={16} color={colors.archived} strokeWidth={1.75} />
        </Pressable>
      ) : (
        <GripVertical size={16} color={colors.archived} strokeWidth={1.75} />
      )}
    </Pressable>
  );
}
