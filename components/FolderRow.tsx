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
};

/**
 * A folder line item in the Knowledge screen: tile + name + priority chip
 * + sub-line + retention bar + drag handle.
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
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} folder, priority ${priority}, ${count} items`}
      className="flex-row items-center rounded-card bg-surface"
      style={({ pressed }) => ({
        paddingVertical: 18,
        paddingLeft: 16,
        paddingRight: 14,
        gap: 14,
        borderWidth: 1,
        borderColor: colors.hairline,
        opacity: pressed ? 0.88 : 1,
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

      <RetentionBar active={active} fading={fading} archived={archived} width={72} height={6} />
      <GripVertical size={16} color="#C5C3BE" strokeWidth={1.6} />
    </Pressable>
  );
}
