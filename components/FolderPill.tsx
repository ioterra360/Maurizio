import { Text, View } from "react-native";
import { FONT, colors, layer as layerTokens, layerTint, type LayerKey } from "@/theme/tokens";

type Props = {
  folder: string;
  layerKey: LayerKey;
};

/**
 * Tiny tinted pill that sits ABOVE the term on every review screen.
 * Communicates which folder the card belongs to AND, via the color tint,
 * which layer the user is in. Mockup pattern:
 *
 *   _design_drop/memora/project/reviews.jsx — `Folder: Japanese` style pill
 *
 * Per layer the tint changes:
 *   scan → #E6F0FA (pale blue)
 *   reinforcement → #F1EEFC (pale violet)
 *   focus → #EDF0F6 (pale navy)
 */
export function FolderPill({ folder, layerKey }: Props) {
  const tint = layerTint[layerKey];
  const color = layerTokens[layerKey].color;
  return (
    <View
      style={{
        alignSelf: "center",
        backgroundColor: tint,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
      }}
    >
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 11.5,
          color,
          letterSpacing: 0.2,
        }}
      >
        {folder}
      </Text>
    </View>
  );
}
