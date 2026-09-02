import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useLocalSearchParams } from "expo-router";

import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { Tappable } from "@/components/Tappable";
import { ADD_PREVIEW_BY_KIND } from "@/lib/folder-data";
import { FONT, radii, useColors } from "@/theme/tokens";
import {
  DAILY_INPUT_CAP_DEFAULT,
  FOLDER_KINDS,
  TERM_COUNTER_FROM,
  TERM_MAX_LENGTH,
  type FolderKind,
} from "@/lib/constants";
import { applyFolderOrder, priorityOf, useFolderOrderStore } from "@/lib/folder-order-store";
import { createMemory, fetchProfile, fetchTodayInputCount } from "@/lib/api";
import { useFoldersWithStats } from "@/lib/use-folders";
import type { FolderWithStats } from "@/lib/mappers";
import { useAuthStore } from "@/lib/auth-store";
import { useUIStore } from "@/lib/ui-store";
import { reportError } from "@/lib/report-error";
import { safeBack } from "@/lib/safe-back";
import { consumeIntentionalAddOpen } from "@/lib/add-gate";
import { useT } from "@/lib/i18n";
import { shortDateTime } from "@/lib/format";
import { firstReview } from "@/features/srs/phases";
import { itemTypesFor, legacyKindFor, templateHasReading } from "@/lib/folder-taxonomy";

export default function AddScreen() {
  const colors = useColors();
  // Add is a root-level modal (declared in app/_layout.tsx so it can slide
  // up over the tab bar), so it sits OUTSIDE the (app) auth gate. Guard
  // here explicitly — without this, a not-yet-logged-in user could land
  // on Add via state restoration or a deep link and never see /login.
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  // Single-shot gate: if the modal mounted from Expo Router's state
  // restoration on a fast-refresh / shake-Reload (rather than from a user
  // tap on a FAB), bounce out — the user shouldn't be dumped into "create
  // memory" by reloading. See lib/add-gate.ts for the full rationale.
  const [wasOpenedIntentionally] = useState(() => consumeIntentionalAddOpen());
  // Preselect the originating folder when pushed from folder detail; for a
  // paramless open (Knowledge FAB) the first folder the user owns wins once
  // the list arrives (effect below) — there is no fixed default kind any
  // more, a user may own only "law" or only a custom folder.
  const params = useLocalSearchParams<{ folderId?: string; kind?: string }>();
  // ?folderId= dalla scheda cartella; ?kind= sopravvive per le navigazioni
  // salvate dai client pre-OTA (si risolve sotto, quando la lista arriva).
  const paramFolderId = params.folderId && params.folderId.length > 0 ? params.folderId : null;
  // Add lives outside the (app) group, so hydrate the persisted folder
  // order here too — the pill row and #N suffixes must match Knowledge.
  const order = useFolderOrderStore((s) => s.order);
  const orderHydrated = useFolderOrderStore((s) => s.hydrated);
  const hydrateOrder = useFolderOrderStore((s) => s.hydrate);
  useEffect(() => {
    if (!orderHydrated) void hydrateOrder();
  }, [orderHydrated, hydrateOrder]);
  // Cartelle dal DB — l'identità è folders.id (tassonomia 2026-09-02);
  // chip e anteprima si derivano da category/templateId della riga.
  const { folders: allFolders, loading: foldersLoading, error: foldersError } =
    useFoldersWithStats();
  const folders = useMemo(
    () => applyFolderOrder(allFolders, order),
    [allFolders, order],
  );
  const [folderId, setFolderId] = useState<string | null>(paramFolderId);
  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === folderId) ?? null,
    [folders, folderId],
  );
  const [type, setType] = useState<string>("word");
  // Snap the selection onto a folder the user actually owns (first in the
  // custom order) whenever the current id isn't in their list — covers the
  // paramless open, a legacy ?kind= and a folder they deleted.
  useEffect(() => {
    if (folders.length === 0) return;
    if (folderId && folders.some((f) => f.id === folderId)) return;
    const byLegacyKind = params.kind ? folders.find((f) => f.kind === params.kind) : null;
    const first = byLegacyKind ?? folders[0];
    if (!first) return;
    setFolderId(first.id);
    setType(itemTypesFor(first.category, first.templateId)[0]?.value ?? "word");
  }, [folders, folderId, params.kind]);
  const [term, setTerm] = useState("");
  const [reading, setReading] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [saving, setSaving] = useState(false);
  // Tallest ScrollView viewport seen (keyboard closed) — see onLayout below.
  const [viewportH, setViewportH] = useState(0);
  const [savePressed, setSavePressed] = useState(false);
  // Which required field is empty after a save attempt. Buttons are never
  // silently disabled: tapping with a missing field explains and focuses it.
  const [missing, setMissing] = useState<"term" | "definition" | null>(null);
  const termRef = useRef<TextInput>(null);
  const definitionRef = useRef<TextInput>(null);
  // Contatore giornaliero vero: inserimenti di oggi + tetto dal profilo.
  const [dailyCount, setDailyCount] = useState<number | null>(null);
  const [dailyMax, setDailyMax] = useState(DAILY_INPUT_CAP_DEFAULT);
  const showToast = useUIStore((s) => s.showToast);
  const { t } = useT();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([fetchTodayInputCount(user.id), fetchProfile(user.id)])
      .then(([count, profile]) => {
        if (cancelled) return;
        setDailyCount(count);
        if (profile) setDailyMax(profile.dailyInputCap);
      })
      .catch((e) => {
        reportError("add/daily-count-load", e);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!wasOpenedIntentionally) return <Redirect href="/(app)/today" />;
  // Zero folders = nothing to save into. Never a silent no-op: send the user
  // to the topic pick, which creates their one folder and comes back.
  if (!foldersLoading && !foldersError && allFolders.length === 0) {
    return <Redirect href={"/choose-topic" as never} />;
  }

  // Anteprima per categoria: si riusa la mappa legacy passando dal kind
  // derivato (lingue→es/jp, materie→medicine/law, resto→custom).
  const previewKind = (selectedFolder ? legacyKindFor(selectedFolder.templateId) : "custom") as FolderKind;
  const preview = ADD_PREVIEW_BY_KIND[previewKind] ?? ADD_PREVIEW_BY_KIND.custom;
  const types = itemTypesFor(selectedFolder?.category, selectedFolder?.templateId);
  const showReading = templateHasReading(selectedFolder?.templateId);
  // L'anteprima mostrava un fisso "domani, 8:00" che non corrispondeva a
  // nulla: le 8:00 venivano da una colonna (profiles.morning_review_at) che
  // nessuno leggeva. Ora è l'orario vero del primo ripasso, T0 + 20 ore.
  const firstReviewLabel = t("add.previewFirstReview", {
    time: shortDateTime(firstReview().nextReviewAt),
  });
  const dailyLimitReached = (dailyCount ?? 0) >= dailyMax;
  // Limite giornaliero = avviso MORBIDO, mai blocco (docs/SRS.md): si può
  // salvare anche oltre il tetto — domani il carico sarà solo più alto.
  const doSave = async (addAnother: boolean) => {
    if (saving || !user) return;
    if (!term.trim()) {
      setMissing("term");
      termRef.current?.focus();
      return;
    }
    if (!definition.trim()) {
      setMissing("definition");
      definitionRef.current?.focus();
      return;
    }
    setMissing(null);
    const folderRow = selectedFolder;
    if (!folderRow) {
      // Folders still loading or failed to load — say so instead of eating
      // the tap (the zero-folder case is redirected above).
      showToast(
        foldersError
          ? t("add.foldersNotLoaded")
          : t("add.loadingFolders"),
      );
      return;
    }
    setSaving(true);
    try {
      await createMemory({
        userId: user.id,
        folderId: folderRow.id,
        term: term.trim(),
        reading: showReading && reading.trim() ? reading.trim() : undefined,
        definition: definition.trim(),
        example: example.trim() ? example.trim() : undefined,
        itemType: type,
      });
      setDailyCount((c) => (c ?? 0) + 1);
      showToast(t("add.savedToast", { name: folderRow.name }));
      if (addAnother) {
        // Keep the fields cleared for fast successive adds; no nav.
        setTerm("");
        setReading("");
        setDefinition("");
        setExample("");
        termRef.current?.focus();
      } else {
        // Toast is rendered at the root layout — it survives this unmount.
        // safeBack dismisses the keyboard first to avoid an Android race that
        // leaves the IME attached to the unmounted TextInput.
        safeBack("/(app)/knowledge");
      }
    } catch (e) {
      reportError("add/save", e);
      showToast(t("add.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => safeBack("/(app)/knowledge");

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar
        title={t("add.title")}
        onBack={handleBack}
        rightSlot={
          <Pressable
            onPress={() => doSave(false)}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t("common.save")}
            hitSlop={10}
            onPressIn={() => setSavePressed(true)}
            onPressOut={() => setSavePressed(false)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 8,
              opacity: saving ? 0.35 : savePressed ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 15,
                lineHeight: 20,
                color: colors.navy,
                letterSpacing: -0.1,
              }}
            >
              {t("common.save")}
            </Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        // Android needs "height" here, not undefined — without it the soft
        // keyboard covers the pinned Save buttons and the screen feels
        // frozen because the only visible action is unreachable.
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          // The action footer lives INSIDE the scroll content, at the bottom.
          // minHeight is the viewport measured with the keyboard closed (kept
          // as a max), so with the keyboard open the content keeps its height
          // and the buttons stay where they were, under the keyboard, instead
          // of riding up with it (Angelo, 2026-08-27).
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setViewportH((prev) => (h > prev ? h : prev));
          }}
          contentContainerStyle={{ flexGrow: 1, minHeight: viewportH, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          {/* Folder pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 12 }}
          >
            {folders.map((f) => {
              const on = folderId === f.id;
              return (
                <Tappable
                  key={f.id}
                  onPress={() => {
                    setFolderId(f.id);
                    // Reset the type if it isn't valid for the new folder —
                    // done here (not in an effect) so both states update in
                    // one batched render, with no invalid-type frame.
                    const ts = itemTypesFor(f.category, f.templateId);
                    if (!ts.some((t) => t.value === type)) {
                      setType(ts[0]?.value ?? "word");
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  pressedOpacity={0.6}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: radii.chip,
                    height: 36,
                    paddingHorizontal: 12,
                    gap: 6,
                    backgroundColor: on ? colors.accent : colors.surface,
                    borderWidth: on ? 0 : 1,
                    borderColor: colors.hairline,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: on ? FONT.semibold : FONT.medium,
                      fontSize: 14,
                      color: on ? colors.onAccent : colors.navy,
                      letterSpacing: -0.07,
                    }}
                  >
                    {f.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONT.medium,
                      fontSize: 12,
                      color: on ? "rgba(250,248,244,0.72)" : colors.midGrey,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    · #{priorityOf(f.id, order)}
                  </Text>
                </Tappable>
              );
            })}
          </ScrollView>

          {/* Campi del ricordo — fronte/retro espliciti (spec core-loop §3) */}
          <View style={{ paddingHorizontal: 18, gap: 10 }}>
            <TextInput
              ref={termRef}
              value={term}
              onChangeText={(t) => {
                setTerm(t);
                if (missing === "term") setMissing(null);
              }}
              placeholder={t("add.termPlaceholder")}
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={t("add.termLabel")}
              maxLength={TERM_MAX_LENGTH}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: missing === "term" ? colors.danger : colors.hairline,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontFamily: FONT.semibold,
                fontSize: 18,
                color: colors.navy,
                letterSpacing: -0.2,
              }}
            />
            {/* Contatore visibile solo nell'ultimo tratto (da 40 su 50), come
                da richiesta Maurizio 2026-09-01: limite duro a 50 lettere. */}
            {term.length >= TERM_COUNTER_FROM ? (
              <Text
                style={{
                  alignSelf: "flex-end",
                  marginTop: -6,
                  fontFamily: FONT.medium,
                  fontSize: 11.5,
                  color: term.length >= TERM_MAX_LENGTH ? colors.danger : colors.midGrey,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {term.length} / {TERM_MAX_LENGTH}
              </Text>
            ) : null}
            {missing === "term" ? (
              <FieldHint>{t("add.termMissingHint")}</FieldHint>
            ) : null}
            {showReading ? (
              <TextInput
                value={reading}
                onChangeText={setReading}
                placeholder={t("add.readingPlaceholder")}
                placeholderTextColor={colors.placeholder}
                accessibilityLabel={t("add.readingLabel")}
                autoCapitalize="none"
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontFamily: FONT.regular,
                  fontSize: 15,
                  color: colors.navy,
                  letterSpacing: -0.07,
                }}
              />
            ) : null}
            <TextInput
              ref={definitionRef}
              value={definition}
              onChangeText={(t) => {
                setDefinition(t);
                if (missing === "definition") setMissing(null);
              }}
              placeholder={t("add.definitionPlaceholder")}
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={t("add.definitionLabel")}
              multiline
              textAlignVertical="top"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: missing === "definition" ? colors.danger : colors.hairline,
                padding: 16,
                minHeight: 90,
                fontFamily: FONT.regular,
                fontSize: 16,
                color: colors.navy,
                lineHeight: 22,
                letterSpacing: -0.07,
              }}
            />
            {missing === "definition" ? (
              <FieldHint>{t("add.definitionMissingHint")}</FieldHint>
            ) : null}
            <TextInput
              value={example}
              onChangeText={setExample}
              placeholder={t("add.examplePlaceholder")}
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={t("add.exampleLabel")}
              multiline
              textAlignVertical="top"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.hairline,
                padding: 16,
                minHeight: 70,
                fontFamily: FONT.regular,
                fontSize: 15,
                color: colors.navy,
                lineHeight: 21,
                letterSpacing: -0.07,
              }}
            />
          </View>

          {/* Type chips — content-hugging (no flex:1): equal-split widths
              squeezed "Grammatica" while "Kanji" floated in dead space.
              flexWrap lets long label sets break onto a second row. */}
          <View
            className="flex-row"
            style={{ paddingHorizontal: 18, paddingTop: 14, gap: 6, flexWrap: "wrap" }}
          >
            {types.map((t) => {
              const on = type === t.value;
              return (
                <Tappable
                  key={t.value}
                  onPress={() => setType(t.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  pressedOpacity={0.6}
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radii.chip,
                    height: 32,
                    paddingHorizontal: 14,
                    backgroundColor: on ? colors.accent : colors.surface,
                    borderWidth: on ? 0 : 1,
                    borderColor: colors.hairline,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: on ? FONT.semibold : FONT.medium,
                      fontSize: 13,
                      color: on ? colors.onAccent : colors.navy,
                      letterSpacing: -0.04,
                    }}
                  >
                    {t.label}
                  </Text>
                </Tappable>
              );
            })}
          </View>

          {/* Auto preview card */}
          <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
            <View
              className="rounded-card bg-surface"
              style={{
                borderWidth: 1,
                borderColor: colors.hairline,
                overflow: "hidden",
              }}
            >
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 11,
                    color: colors.midGrey,
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                  }}
                >
                  {t("add.previewFront")}
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 20,
                    color: colors.navy,
                    marginTop: 4,
                    letterSpacing: -0.4,
                  }}
                >
                  {term.trim() ? term.trim().slice(0, 60) : preview.front}
                </Text>
                {showReading && reading.trim() ? (
                  <Text
                    style={{
                      fontFamily: FONT.regular,
                      fontSize: 13.5,
                      color: colors.midGrey,
                      marginTop: 2,
                      letterSpacing: 0.2,
                    }}
                  >
                    {reading.trim()}
                  </Text>
                ) : null}
              </View>
              <View style={{ height: 1, backgroundColor: colors.divider, marginHorizontal: 16 }} />
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 11,
                    color: colors.midGrey,
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                  }}
                >
                  {t("add.previewBack")}
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.regular,
                    fontSize: 14,
                    color: colors.navy,
                    marginTop: 4,
                    lineHeight: 20,
                  }}
                >
                  {definition.trim() ? definition.trim().slice(0, 160) : preview.back}
                </Text>
                {example.trim() ? (
                  <Text
                    style={{
                      fontFamily: FONT.regular,
                      fontStyle: "italic",
                      fontSize: 13,
                      color: colors.midGrey,
                      marginTop: 6,
                      lineHeight: 18,
                    }}
                  >
                    {example.trim().slice(0, 120)}
                  </Text>
                ) : null}
              </View>
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: colors.canvas,
                  borderTopWidth: 1,
                  borderTopColor: colors.hairline,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT.regular,
                    fontSize: 12,
                    color: colors.midGrey,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {firstReviewLabel}
                </Text>
              </View>
            </View>
          </View>

          <Text
            style={{
              paddingHorizontal: 22,
              paddingTop: 12,
              fontFamily: FONT.regular,
              fontSize: 12.5,
              color: colors.midGrey,
              lineHeight: 17,
            }}
          >
            {t("add.useItTodayHint")}
          </Text>

        {/* Bottom actions — pushed to the bottom of the (min-height) content */}
        <View style={{ flex: 1 }} />
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 20,
            gap: 10,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: dailyLimitReached ? FONT.medium : FONT.regular,
              fontSize: dailyLimitReached ? 12.5 : 12,
              color: dailyLimitReached ? colors.danger : colors.midGrey,
              fontVariant: ["tabular-nums"],
              textAlign: "center",
              paddingHorizontal: 8,
            }}
          >
            {dailyCount === null
              ? "…"
              : dailyLimitReached
                ? t("add.overDailyLimit", { count: dailyCount, max: dailyMax })
                : t("add.dailyCounter", { count: dailyCount, max: dailyMax })}
          </Text>
          <GhostButton
            label={t("add.saveAndAddAnother")}
            variant="outline"
            onPress={() => doSave(true)}
            disabled={saving}
          />
          <PrimaryButton label={t("add.saveAndContinue")} onPress={() => doSave(false)} loading={saving} />
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

/** Inline reason under a required field that was left empty on save. */
function FieldHint({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: FONT.medium,
        fontSize: 12.5,
        color: colors.danger,
        marginTop: -4,
        paddingHorizontal: 4,
      }}
    >
      {children}
    </Text>
  );
}
