import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { TopBar } from "@/components/TopBar";
import { Tappable } from "@/components/Tappable";
import { MascotLoader } from "@/components/MascotLoader";
import { fetchMemoriesInRange, fetchUpcomingCounts } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { dayKeyOf } from "@/lib/upcoming";
import { t, useT, type TKey } from "@/lib/i18n";
import { reportError } from "@/lib/report-error";
import type { Memory } from "@/lib/mappers";
import { FONT, radii, useColors } from "@/theme/tokens";
import { shortDateTime } from "@/lib/format";

const MONTH_LONG_KEYS: readonly TKey[] = [
  "format.monthLongJanuary", "format.monthLongFebruary", "format.monthLongMarch",
  "format.monthLongApril", "format.monthLongMay", "format.monthLongJune",
  "format.monthLongJuly", "format.monthLongAugust", "format.monthLongSeptember",
  "format.monthLongOctober", "format.monthLongNovember", "format.monthLongDecember",
];

// Settimana che parte dal lunedì (convenzione europea, tutte e 4 le lingue).
const WEEKDAY_KEYS: readonly TKey[] = [
  "format.dayShortMon", "format.dayShortTue", "format.dayShortWed",
  "format.dayShortThu", "format.dayShortFri", "format.dayShortSat", "format.dayShortSun",
];

/**
 * Calendario dei prossimi ripassi (Maurizio 2026-09-01): griglia mensile con
 * il numero di ricordi in scadenza per giorno; il tocco su un giorno apre la
 * lista di quei ricordi, e da lì la scheda del ricordo.
 *
 * I conteggi sono per MEZZANOTTE LOCALE (lib/upcoming.ts): un ripasso delle
 * 23:30 sta nel suo giorno anche a est di Greenwich.
 */
export default function UpcomingScreen() {
  const { t, tp } = useT();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  // Primo giorno del mese visualizzato (mezzanotte locale).
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map());
  const [loading, setLoading] = useState(true);
  // Giorno aperto nel foglio + i suoi ricordi.
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dayItems, setDayItems] = useState<Memory[] | null>(null);

  const monthEnd = useMemo(
    () => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999),
    [monthStart],
  );

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    fetchUpcomingCounts(user.id, monthStart.toISOString(), monthEnd.toISOString())
      .then((m) => setCounts(m))
      .catch((e) => reportError("upcoming/counts", e))
      .finally(() => setLoading(false));
  }, [user, monthStart, monthEnd]);

  useEffect(load, [load]);

  const openDaySheet = (dayKey: string) => {
    if (!user) return;
    setOpenDay(dayKey);
    setDayItems(null);
    const from = new Date(`${dayKey}T00:00:00`);
    const to = new Date(`${dayKey}T23:59:59.999`);
    fetchMemoriesInRange(user.id, from.toISOString(), to.toISOString())
      .then((items) => setDayItems(items))
      .catch((e) => {
        reportError("upcoming/day-items", e);
        setDayItems([]);
      });
  };

  // Celle del mese: offset del primo giorno (settimana che parte dal lunedì).
  const cells = useMemo(() => {
    const firstWeekday = (monthStart.getDay() + 6) % 7; // 0 = lunedì
    const daysInMonth = monthEnd.getDate();
    const out: Array<{ dayKey: string; day: number } | null> = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({
        dayKey: dayKeyOf(new Date(monthStart.getFullYear(), monthStart.getMonth(), d)),
        day: d,
      });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [monthStart, monthEnd]);

  const todayKey = dayKeyOf(new Date());
  const monthLabel = `${t(MONTH_LONG_KEYS[monthStart.getMonth()])} ${monthStart.getFullYear()}`;
  const hasAny = [...counts.values()].some((n) => n > 0);
  const shiftMonth = (delta: number) =>
    setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const CELL = "13.6%"; // 7 colonne con un filo di gap

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar title={t("upcoming.title")} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Intestazione mese con frecce. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 14,
          }}
        >
          <Tappable
            accessibilityRole="button"
            accessibilityLabel="←"
            onPress={() => shiftMonth(-1)}
            hitSlop={8}
            pressedOpacity={0.6}
            style={{ padding: 8 }}
          >
            <ChevronLeft size={22} color={colors.navy} strokeWidth={2} />
          </Tappable>
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 18,
              color: colors.navy,
              letterSpacing: -0.3,
              textTransform: "capitalize",
            }}
          >
            {monthLabel}
          </Text>
          <Tappable
            accessibilityRole="button"
            accessibilityLabel="→"
            onPress={() => shiftMonth(1)}
            hitSlop={8}
            pressedOpacity={0.6}
            style={{ padding: 8 }}
          >
            <ChevronRight size={22} color={colors.navy} strokeWidth={2} />
          </Tappable>
        </View>

        {/* Griglia: intestazione dei giorni + celle. */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.card,
            borderWidth: 1,
            borderColor: colors.hairline,
            padding: 10,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            {WEEKDAY_KEYS.map((k) => (
              <Text
                key={k}
                style={{
                  width: CELL,
                  textAlign: "center",
                  fontFamily: FONT.semibold,
                  fontSize: 10.5,
                  color: colors.midGrey,
                  letterSpacing: 0.8,
                }}
              >
                {t(k)}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {cells.map((c, i) =>
              c === null ? (
                <View key={`x${i}`} style={{ width: CELL, height: 52 }} />
              ) : (
                <Tappable
                  key={c.dayKey}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.day} · ${tp("upcoming.dayCount", counts.get(c.dayKey) ?? 0)}`}
                  onPress={() => {
                    if ((counts.get(c.dayKey) ?? 0) > 0) openDaySheet(c.dayKey);
                  }}
                  pressedOpacity={0.7}
                  containerStyle={{ width: CELL }}
                  style={{
                    height: 52,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    borderRadius: radii.chip,
                    backgroundColor: c.dayKey === todayKey ? colors.tagUserBg : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: c.dayKey === todayKey ? FONT.bold : FONT.medium,
                      fontSize: 14,
                      color: c.dayKey < todayKey ? colors.placeholder : colors.navy,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {c.day}
                  </Text>
                  {(counts.get(c.dayKey) ?? 0) > 0 ? (
                    <View
                      style={{
                        minWidth: 18,
                        height: 16,
                        paddingHorizontal: 4,
                        borderRadius: 8,
                        backgroundColor: colors.accent,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FONT.semibold,
                          fontSize: 10,
                          color: colors.onAccent,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {counts.get(c.dayKey)}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ height: 16 }} />
                  )}
                </Tappable>
              ),
            )}
          </View>
        </View>

        {loading ? (
          <View style={{ paddingTop: 28, alignItems: "center" }}>
            <MascotLoader label={t("common.oneMoment")} size={72} />
          </View>
        ) : !hasAny ? (
          <Text
            style={{
              paddingTop: 24,
              textAlign: "center",
              fontFamily: FONT.regular,
              fontSize: 14,
              color: colors.midGrey,
            }}
          >
            {t("upcoming.emptyMonth")}
          </Text>
        ) : null}
      </ScrollView>

      {/* Foglio del giorno: i ricordi in scadenza, tocco → scheda. */}
      <Modal
        visible={openDay !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenDay(null)}
      >
        <Pressable
          accessibilityLabel={t("common.close")}
          onPress={() => setOpenDay(null)}
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(15,27,51,0.32)" }}
        />
        <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
          <View
            style={{
              backgroundColor: colors.warmWhite,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingHorizontal: 18,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 20),
              maxHeight: "70%",
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
                borderRadius: 999,
                backgroundColor: colors.switchTrackOff,
                marginBottom: 12,
              }}
            />
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 18,
                color: colors.navy,
                letterSpacing: -0.3,
                marginBottom: 8,
                textTransform: "capitalize",
              }}
            >
              {openDay ? dateBadgeForDay(openDay) : ""}
            </Text>
            {dayItems === null ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <MascotLoader label={t("common.oneMoment")} size={64} />
              </View>
            ) : dayItems.length === 0 ? (
              <Text
                style={{
                  paddingVertical: 20,
                  textAlign: "center",
                  fontFamily: FONT.regular,
                  fontSize: 14,
                  color: colors.midGrey,
                }}
              >
                {t("upcoming.emptyDay")}
              </Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {dayItems.map((m) => (
                  <Tappable
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityLabel={m.term}
                    onPress={() => {
                      setOpenDay(null);
                      router.push({ pathname: "/memory/[id]", params: { id: m.id } });
                    }}
                    pressedOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 13,
                      paddingHorizontal: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.hairline,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: FONT.semibold, fontSize: 15.5, color: colors.navy }}
                      >
                        {m.term}
                      </Text>
                      <Text
                        style={{ fontFamily: FONT.regular, fontSize: 12, color: colors.midGrey }}
                      >
                        {shortDateTime(m.nextReviewAt)}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.midGrey} strokeWidth={2} />
                  </Tappable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** "3 settembre" dal dayKey — per il titolo del foglio. */
function dateBadgeForDay(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return `${d.getDate()} ${t(MONTH_LONG_KEYS[d.getMonth()])}`;
}
