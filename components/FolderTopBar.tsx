import { Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Settings as SettingsIcon } from "lucide-react-native";

import { FolderTile } from "@/components/FolderTile";
import { Tappable } from "@/components/Tappable";
import { FONT, colors } from "@/theme/tokens";
import { useT } from "@/lib/i18n";
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
  const { t } = useT();
  return (
    <View
      className="flex-row items-center justify-between"
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        height: 48,
      }}
    >
      <Tappable
        // navigate (not back): the label promises "alle cartelle", and a
        // history pop could land anywhere the user came from (Oggi,
        // Progressi). navigate is deterministic and dedupes in-history tabs.
        onPress={() => router.navigate("/(app)/knowledge")}
        accessibilityRole="button"
        accessibilityLabel={t("folderTopBar.backToFolders")}
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
            {t("folderTopBar.priorityBadge", { priority })}
          </Text>
        </View>
      </View>

      <Tappable
        onPress={() => router.push({ pathname: "/folder-settings", params: { kind } } as never)}
        accessibilityRole="button"
        accessibilityLabel={t("folderTopBar.settingsA11y")}
        pressedOpacity={0.6}
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SettingsIcon size={20} color={colors.navy} strokeWidth={1.7} />
      </Tappable>
    </View>
  );
}
