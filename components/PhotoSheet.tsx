import { Modal, Text, View } from "react-native";
import { Camera, Images, Trash2 } from "lucide-react-native";

import { GhostButton } from "@/components/GhostButton";
import { Tappable } from "@/components/Tappable";
import { tap } from "@/lib/feedback";
import { useT } from "@/lib/i18n";
import type { PhotoSource } from "@/lib/photo-utils";
import { FONT, useColors } from "@/theme/tokens";

type Props = {
  visible: boolean;
  /** Con una foto già scelta compare anche "Rimuovi foto". */
  hasPhoto: boolean;
  onPick: (source: PhotoSource) => void;
  onRemove: () => void;
  onClose: () => void;
  /** iOS: il Modal ha FINITO di chiudersi. Solo da qui si può presentare il picker. */
  onDismissed?: () => void;
};

/**
 * Foglio dal basso del "+" nel box del significato: Fotocamera / Libreria /
 * Rimuovi (spec §B5). Su iOS il picker NON si presenta finché questo Modal è
 * ancora sullo schermo: `setVisible(false)` non chiude in modo sincrono e la
 * chiusura è animata (~300 ms). Perciò il foglio espone `onDismissed`
 * (`Modal.onDismiss`, iOS-only, react-native/Libraries/Modal/Modal.d.ts:83) e
 * chi lo monta lancia il picker LÌ, non dentro onPick.
 */
export function PhotoSheet({
  visible,
  hasPhoto,
  onPick,
  onRemove,
  onClose,
  onDismissed,
}: Props) {
  const { t } = useT();
  const colors = useColors();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismissed}
    >
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
              backgroundColor: colors.switchTrackOff,
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
            {t("add.photoSheetTitle")}
          </Text>

          <View style={{ marginTop: 14 }}>
            <Row
              icon={<Camera size={20} color={colors.navy} strokeWidth={1.9} />}
              label={t("add.photoCamera")}
              onPress={() => onPick("camera")}
            />
            <Row
              icon={<Images size={20} color={colors.navy} strokeWidth={1.9} />}
              label={t("add.photoLibrary")}
              onPress={() => onPick("library")}
            />
            {hasPhoto ? (
              <Row
                icon={<Trash2 size={20} color={colors.danger} strokeWidth={1.9} />}
                label={t("add.photoRemove")}
                danger
                onPress={onRemove}
              />
            ) : null}
          </View>

          <View style={{ marginTop: 16 }}>
            <GhostButton label={t("common.cancel")} onPress={onClose} variant="link" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Tappable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      pressedOpacity={0.6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        height: 52,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
      }}
    >
      {icon}
      <Text
        style={{
          fontFamily: FONT.medium,
          fontSize: 15.5,
          color: danger ? colors.danger : colors.navy,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Tappable>
  );
}
