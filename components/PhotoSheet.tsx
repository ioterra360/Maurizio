import { Text, View } from "react-native";
import { Camera, Images, Trash2 } from "lucide-react-native";

import { BottomSheetShell } from "@/components/BottomSheetShell";
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
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      title={t("add.photoSheetTitle")}
    >
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
    </BottomSheetShell>
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
