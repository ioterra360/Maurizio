import { Modal, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Tappable } from "@/components/Tappable";
import { useT } from "@/lib/i18n";
import { FONT, useColors } from "@/theme/tokens";

type Props = {
  visible: boolean;
  /** Chiusura richiesta: tocco sul backdrop e tasto indietro di Android. */
  onClose: () => void;
  /**
   * iOS: il Modal ha FINITO di chiudersi (`Modal.onDismiss`, iOS-only,
   * react-native/Libraries/Modal/Modal.d.ts:83). Serve a chi presenta un
   * altro modale nativo — il picker delle foto — subito dopo la chiusura.
   */
  onDismissed?: () => void;
  /** Titolo grande del foglio. Omesso: lo disegna il chiamante nei children. */
  title?: string;
  /**
   * false mentre un'operazione è in corso: il backdrop smette di chiudere.
   * `onRequestClose` resta attivo, come prima dell'estrazione del guscio.
   */
  closeOnBackdrop?: boolean;
  /**
   * Geometria extra del foglio (padding, altezza massima) per i fogli che
   * scrollano. Solo misure: colori, raggi e ombra restano del guscio.
   */
  sheetStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * Il guscio condiviso dei fogli dal basso: Modal + backdrop + foglio +
 * maniglia + titolo opzionale. Backdrop e foglio sono FRATELLI dentro un
 * `View` in `flex-end`: RN `Pressable` ignora lo `stopPropagation` sintetico,
 * quindi annidare il foglio nel backdrop lo renderebbe intoccabile — solo il
 * backdrop chiude. Esisteva in tre copie (FolderSortSheet, MoveSheet,
 * PhotoSheet) e la copia di MoveSheet era già divergente: da qui in poi la
 * geometria del guscio si cambia in un posto solo.
 */
export function BottomSheetShell({
  visible,
  onClose,
  onDismissed,
  title,
  closeOnBackdrop = true,
  sheetStyle,
  children,
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
          onPress={() => {
            if (closeOnBackdrop) onClose();
          }}
          pressedOpacity={1}
          containerStyle={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          style={{ flex: 1, backgroundColor: "rgba(15,27,51,0.32)" }}
        >
          <View />
        </Tappable>
        <View
          style={[
            {
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
            },
            sheetStyle,
          ]}
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
          {title ? (
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 22,
                color: colors.navy,
                lineHeight: 26,
                letterSpacing: -0.4,
              }}
            >
              {title}
            </Text>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}
