import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Mascot } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { useT } from "@/lib/i18n";
import { FONT, useColors } from "@/theme/tokens";

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * iOS: il Modal ha FINITO di chiudersi (`Modal.onDismiss`, iOS-only,
   * react-native/Libraries/Modal/Modal.d.ts). Serve a chi, dopo il tocco su
   * "conferma", deve presentare qualcos'altro di NATIVO — una rotta
   * `presentation: "modal"` come `/paywall` — perche' finche' questo Modal
   * e' vivo il suo view controller e' gia' occupato e UIKit rifiuta la
   * seconda presentazione (vedi `lib/modal-nav.ts`). Stessa prop, stesso
   * motivo, di `components/BottomSheetShell.tsx`.
   */
  onDismissed?: () => void;
};

/**
 * Foglio dal basso con la mascotte che parla — il primo componente
 * mascotte-con-messaggio dell'app (CoachTip è morto da tempo). Usato per
 * gli avvisi sul carico del limite giornaliero (Maurizio 2026-09-01) e
 * pensato per essere riusato dal futuro paywall.
 *
 * La Mascot è decorativa per gli screen reader (accessibilityElementsHidden
 * nel componente): il messaggio vive nei Text fratelli, come da regola.
 * Backdrop e sheet sono FRATELLI (RN Pressable ignora stopPropagation).
 */
export function MascotDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  onDismissed,
}: Props) {
  const colors = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      onDismiss={onDismissed}
    >
      <Pressable
        accessibilityLabel={t("common.close")}
        onPress={onCancel}
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(15,27,51,0.32)" }}
      />
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View
          style={{
            backgroundColor: colors.warmWhite,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 28),
            shadowColor: "#0F1B33",
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: -8 },
            shadowRadius: 30,
            elevation: 24,
            gap: 12,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.switchTrackOff,
              marginBottom: 4,
            }}
          />
          <View style={{ alignItems: "center" }}>
            <Mascot variant="investigate" size={84} withShadow={false} />
          </View>
          <Text
            accessibilityRole="header"
            style={{
              textAlign: "center",
              fontFamily: FONT.bold,
              fontSize: 20,
              lineHeight: 26,
              color: colors.navy,
              letterSpacing: -0.4,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              textAlign: "center",
              fontFamily: FONT.regular,
              fontSize: 14.5,
              lineHeight: 21,
              color: colors.midGrey,
              paddingHorizontal: 6,
            }}
          >
            {body}
          </Text>
          <View style={{ marginTop: 6, gap: 8 }}>
            <PrimaryButton label={confirmLabel} onPress={onConfirm} />
            {cancelLabel ? (
              <GhostButton variant="link" label={cancelLabel} onPress={onCancel} />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
