import { Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { BottomSheetShell } from "@/components/BottomSheetShell";
import { GhostButton } from "@/components/GhostButton";
import { Tappable } from "@/components/Tappable";
import { tap } from "@/lib/feedback";
import { FOLDER_SORTS, type FolderSort } from "@/lib/folder-sort";
import { useT, type TKey } from "@/lib/i18n";
import { FONT, useColors } from "@/theme/tokens";

/** Catalog keys per sort option — resolved at render so the language switch applies. */
export const SORT_LABEL_KEY: Record<FolderSort, TKey> = {
  due: "folder.sortDue",
  alpha: "folder.sortAlpha",
  newest: "folder.sortNewest",
  oldest: "folder.sortOldest",
};

type Props = {
  visible: boolean;
  current: FolderSort;
  onSelect: (sort: FolderSort) => void;
  onClose: () => void;
};

/**
 * Bottom sheet with the four list orders of the folder screen. The shell —
 * modal, backdrop, sheet, grabber, title — is `BottomSheetShell`.
 */
export function FolderSortSheet({ visible, current, onSelect, onClose }: Props) {
  const { t } = useT();
  const colors = useColors();
  return (
    <BottomSheetShell visible={visible} onClose={onClose} title={t("folder.sortSheetTitle")}>
      <View style={{ marginTop: 14 }}>
        {FOLDER_SORTS.map((sort) => {
          const selected = sort === current;
          return (
            <Tappable
              key={sort}
              onPress={() => {
                tap();
                onSelect(sort);
              }}
              accessibilityRole="button"
              accessibilityLabel={t(SORT_LABEL_KEY[sort])}
              accessibilityState={{ selected }}
              pressedOpacity={0.6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                height: 48,
                borderBottomWidth: 1,
                borderBottomColor: colors.hairline,
              }}
            >
              <Text
                style={{
                  fontFamily: selected ? FONT.semibold : FONT.medium,
                  fontSize: 15,
                  color: colors.navy,
                  letterSpacing: -0.1,
                }}
              >
                {t(SORT_LABEL_KEY[sort])}
              </Text>
              {selected ? <Check size={18} color={colors.navy} strokeWidth={2.2} /> : null}
            </Tappable>
          );
        })}
      </View>

      <View style={{ marginTop: 16 }}>
        <GhostButton label={t("common.cancel")} onPress={onClose} variant="link" />
      </View>
    </BottomSheetShell>
  );
}
