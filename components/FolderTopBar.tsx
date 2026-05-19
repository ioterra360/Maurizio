import { Pressable, Text, View } from "react-native";
import { ChevronLeft, Settings as SettingsIcon } from "lucide-react-native";
import { router } from "expo-router";

import { FolderTile } from "@/components/FolderTile";
import { FONT, colors } from "@/theme/tokens";
import type { FolderKind } from "@/lib/constants";

type Props = {
  kind: FolderKind;
  name: string;
  priority: number;
};

/**
 * Folder-detail-specific top bar: back chevron, centered identity cluster
 * (tile + name + #pri pill), trailing settings cog.
 *
 * Replaces the generic `TopBar` for folder detail — the mockup keeps the
 * folder identity in the top bar (not the hero), freeing the hero for
 * editorial calm.
 */
export function FolderTopBar({ kind, name, priority }: Props) {
  return (
    <View
      className="flex-row items-center justify-between"
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        height: 48,
      }}
    >
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(app)/knowledge"))}
        accessibilityRole="button"
        accessibilityLabel="Back to knowledge"
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

      <View className="flex-row items-center" style={{ gap: 8 }}>
        <FolderTile kind={kind} size={22} />
        <Text
          style={{
            fontFamily: FONT.semibold,
            fontSize: 15,
            color: colors.navy,
            letterSpacing: -0.15,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View
          style={{
            backgroundColor: colors.divider,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
          }}
        >
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 10.5,
              color: colors.midGrey,
              letterSpacing: 0.2,
              fontVariant: ["tabular-nums"],
            }}
          >
            #{priority}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Folder settings"
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <SettingsIcon size={20} color={colors.navy} strokeWidth={1.7} />
      </Pressable>
    </View>
  );
}
