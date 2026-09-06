import { useEffect, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "react-native";

import { BottomSheetShell } from "@/components/BottomSheetShell";
import { GhostButton } from "@/components/GhostButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { tap } from "@/lib/feedback";
import { useT } from "@/lib/i18n";
import { formatSlot, parseSlot } from "@/lib/notifications-core";
import { FONT, radii, useColors } from "@/theme/tokens";

/** Altezza di una riga del rullo e righe visibili (impari: quella centrale è la scelta). */
const ROW_H = 44;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ROW_H;
/** Passo dei minuti. La colonna `time` accetta qualunque minuto; cinque è quanto serve a un promemoria. */
const MINUTE_STEP = 5;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);

type Props = {
  visible: boolean;
  /** "HH:MM" corrente. Minuti fuori passo vengono portati al passo più vicino. */
  value: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
};

/**
 * Foglio dal basso con due rulli, ore e minuti, come l'orologio di iOS —
 * ma in JavaScript: nessuna dipendenza nativa, stesso aspetto su iPhone e
 * Android, tema chiaro/scuro gratis, e arriva via OTA. Sostituisce la
 * griglia di 48 caselle da mezz'ora (Angelo, 6/9/2026: "una tabella
 * scomoda"). Ogni rullo è una ScrollView con snap alla riga; la scelta è
 * la riga sotto la banda centrale.
 */
export function TimeWheelSheet({ visible, value, onConfirm, onClose }: Props) {
  const { t } = useT();
  const colors = useColors();
  const parsed = parseSlot(value) ?? { hour: 8, minute: 0 };
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(nearestStep(parsed.minute));

  // Riallinea i rulli al valore corrente ogni volta che il foglio si apre:
  // fra un'apertura e l'altra l'orario può essere cambiato altrove.
  useEffect(() => {
    if (!visible) return;
    const p = parseSlot(value) ?? { hour: 8, minute: 0 };
    setHour(p.hour);
    setMinute(nearestStep(p.minute));
  }, [visible, value]);

  const chosen = formatSlot(hour, minute);

  return (
    <BottomSheetShell visible={visible} onClose={onClose} title={t("notifications.slotSheetTitle")}>
      <View style={{ marginTop: 14, flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
        <Wheel
          items={HOURS}
          value={hour}
          onChange={setHour}
          accessibilityLabel={t("notifications.hoursWheelA11y")}
          visible={visible}
        />
        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 26,
            color: colors.navy,
            marginHorizontal: 6,
            // Il segno sta all'altezza della riga centrale, non a metà testo.
            marginTop: -4,
          }}
        >
          :
        </Text>
        <Wheel
          items={MINUTES}
          value={minute}
          onChange={setMinute}
          accessibilityLabel={t("notifications.minutesWheelA11y")}
          visible={visible}
        />
      </View>

      <View style={{ marginTop: 18, gap: 8 }}>
        <PrimaryButton
          label={t("notifications.slotConfirm", { time: chosen })}
          onPress={() => {
            tap();
            onConfirm(chosen);
          }}
        />
        <GhostButton label={t("common.cancel")} onPress={onClose} variant="link" />
      </View>
    </BottomSheetShell>
  );
}

function nearestStep(minute: number): number {
  const m = Math.round(minute / MINUTE_STEP) * MINUTE_STEP;
  return m >= 60 ? 60 - MINUTE_STEP : m;
}

type WheelProps = {
  items: readonly number[];
  value: number;
  onChange: (v: number) => void;
  accessibilityLabel: string;
  visible: boolean;
};

function Wheel({ items, value, onChange, accessibilityLabel, visible }: WheelProps) {
  const colors = useColors();
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, items.indexOf(value));

  // Posizionamento iniziale. `contentOffset` basta su iOS; Android lo
  // ignora finché il contenuto non è misurato, quindi si ripete a layout
  // avvenuto e a ogni apertura del foglio (il Modal rimonta la ScrollView).
  const scrollToIndex = (i: number, animated: boolean) =>
    ref.current?.scrollTo({ y: i * ROW_H, animated });
  useEffect(() => {
    if (visible) scrollToIndex(index, false);
    // Solo all'apertura: durante lo scorrimento è l'utente a muovere il rullo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(items.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ROW_H)));
    if (items[i] !== value) {
      tap();
      onChange(items[i]);
    }
  };

  return (
    <View style={{ width: 92, height: ROW_H * VISIBLE }} accessibilityLabel={accessibilityLabel}>
      {/* Banda della scelta: dietro il rullo, alla riga centrale. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: PAD,
          height: ROW_H,
          borderRadius: radii.chip,
          backgroundColor: colors.tagUserBg,
        }}
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * ROW_H }}
        contentContainerStyle={{ paddingVertical: PAD }}
        onLayout={() => scrollToIndex(index, false)}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        nestedScrollEnabled
      >
        {items.map((n) => {
          const on = n === value;
          return (
            <View key={n} style={{ height: ROW_H, alignItems: "center", justifyContent: "center" }}>
              <Text
                style={{
                  fontFamily: on ? FONT.bold : FONT.medium,
                  fontSize: on ? 24 : 20,
                  color: on ? colors.navy : colors.midGrey,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {String(n).padStart(2, "0")}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
