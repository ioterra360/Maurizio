import { Modal, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { GhostButton } from "@/components/GhostButton";
import { Tappable } from "@/components/Tappable";
import { tap } from "@/lib/feedback";
import { FOLDER_SORTS, type FolderSort } from "@/lib/folder-sort";
import { useT, type TKey } from "@/lib/i18n";
import { FONT, colors } from "@/theme/tokens";

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
 * Bottom sheet with the four list orders of the folder screen. Same shell
 * as the Settings confirmation sheet: backdrop and sheet are SIBLINGS (RN
 * Pressable ignores synthetic stopPropagation), only the backdrop closes.
 */
export function FolderSortSheet({ visible, current, onSelect, onClose }: Props) {
  const { t } = useT();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={onClose}
          pressedOpacity={1}
          containerStyle={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          style={{ flex: 1, backgroundColor: "rgba(15,27,51,0.32)" }}
        >
          <View />
        </Tappable>
        <View
          style={{
            backgroundColor: colors.warmWhite,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: 32,
            shadowColor: "#0F1B33",
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: -8 },
            shadowRadius: 30,
            elevation: 24,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#D9D7D1",
              marginBottom: 16,
            }}
          />
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 22,
              color: colors.navy,
              lineHeight: 26,
              letterSpacing: -0.4,
            }}
          >
            {t("folder.sortSheetTitle")}
          </Text>

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
        </View>
      </View>
    </Modal>
  );
}
