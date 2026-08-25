import { useEffect, useMemo, useState } from "react";
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
import { ADD_PREVIEW_BY_KIND, ITEM_TYPES_BY_KIND } from "@/lib/folder-data";
import { FONT, colors, radii } from "@/theme/tokens";
import {
  DAILY_INPUT_CAP_DEFAULT,
  FOLDER_KINDS,
  type FolderKind,
} from "@/lib/constants";
import { applyFolderOrder, priorityOf, useFolderOrderStore } from "@/lib/folder-order-store";
import { createMemory, fetchProfile, fetchTodayInputCount } from "@/lib/api";
import { useFoldersWithStats } from "@/lib/use-folders";
import type { FolderWithStats } from "@/lib/mappers";
import { useAuthStore } from "@/lib/auth-store";
import { useUIStore } from "@/lib/ui-store";
import { safeBack } from "@/lib/safe-back";
import { consumeIntentionalAddOpen } from "@/lib/add-gate";

export default function AddScreen() {
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
  const params = useLocalSearchParams<{ kind?: string }>();
  const paramKind = (FOLDER_KINDS as readonly string[]).includes(params.kind ?? "")
    ? (params.kind as FolderKind)
    : null;
  const initialKind: FolderKind = paramKind ?? "custom";
  // Add lives outside the (app) group, so hydrate the persisted folder
  // order here too — the pill row and #N suffixes must match Knowledge.
  const order = useFolderOrderStore((s) => s.order);
  const orderHydrated = useFolderOrderStore((s) => s.hydrated);
  const hydrateOrder = useFolderOrderStore((s) => s.hydrate);
  useEffect(() => {
    if (!orderHydrated) void hydrateOrder();
  }, [orderHydrated, hydrateOrder]);
  // Cartelle dal DB (serve l'id per il salvataggio), ristrette ai kind
  // noti (4 modelli + custom): le mappe tipo/anteprima sono keyed su di essi.
  const { folders: allFolders, loading: foldersLoading, error: foldersError } =
    useFoldersWithStats();
  const folders = useMemo(
    () =>
      applyFolderOrder(
        allFolders.filter(
          (f): f is FolderWithStats & { kind: FolderKind } =>
            (FOLDER_KINDS as readonly string[]).includes(f.kind as string),
        ),
        order,
      ),
    [allFolders, order],
  );
  const [folder, setFolder] = useState<FolderKind>(initialKind);
  const [type, setType] = useState<string>(
    ITEM_TYPES_BY_KIND[initialKind][0]?.value ?? "word",
  );
  // Snap the selection onto a folder the user actually owns (first in the
  // custom order) whenever the current kind isn't in their list — covers the
  // paramless open and a stale ?kind= for a folder they deleted.
  useEffect(() => {
    if (folders.length === 0) return;
    if (folders.some((f) => f.kind === folder)) return;
    const first = folders[0];
    if (!first) return;
    setFolder(first.kind);
    setType(ITEM_TYPES_BY_KIND[first.kind][0]?.value ?? "word");
  }, [folders, folder]);
  const [term, setTerm] = useState("");
  const [reading, setReading] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [saving, setSaving] = useState(false);
  const [savePressed, setSavePressed] = useState(false);
  // Contatore giornaliero vero: inserimenti di oggi + tetto dal profilo.
  const [dailyCount, setDailyCount] = useState<number | null>(null);
  const [dailyMax, setDailyMax] = useState(DAILY_INPUT_CAP_DEFAULT);
  const showToast = useUIStore((s) => s.showToast);

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
        if (__DEV__) console.warn("[add] daily count load failed", e);
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

  const preview = ADD_PREVIEW_BY_KIND[folder];
  const types = ITEM_TYPES_BY_KIND[folder];
  const dailyLimitReached = (dailyCount ?? 0) >= dailyMax;
  // Limite giornaliero = avviso MORBIDO, mai blocco (docs/SRS.md): si può
  // salvare anche oltre il tetto — domani il carico sarà solo più alto.
  const canSave = term.trim().length > 0 && definition.trim().length > 0 && !saving;

  const doSave = async (addAnother: boolean) => {
    if (!canSave || !user) return;
    const folderRow = folders.find((f) => f.kind === folder);
    if (!folderRow) {
      // Folders still loading or failed to load — say so instead of eating
      // the tap (the zero-folder case is redirected above).
      showToast(
        foldersError
          ? "Cartelle non caricate. Controlla la connessione e riprova."
          : "Un attimo, sto caricando le tue cartelle…",
      );
      return;
    }
    setSaving(true);
    try {
      await createMemory({
        userId: user.id,
        folderId: folderRow.id,
        term: term.trim(),
        reading: folder === "jp" && reading.trim() ? reading.trim() : undefined,
        definition: definition.trim(),
        example: example.trim() ? example.trim() : undefined,
        itemType: type,
      });
      setDailyCount((c) => (c ?? 0) + 1);
      showToast(`Salvato in ${folderRow.name} · primo ripasso domani`);
      if (addAnother) {
        // Keep the fields cleared for fast successive adds; no nav.
        setTerm("");
        setReading("");
        setDefinition("");
        setExample("");
      } else {
        // Toast is rendered at the root layout — it survives this unmount.
        // safeBack dismisses the keyboard first to avoid an Android race that
        // leaves the IME attached to the unmounted TextInput.
        safeBack("/(app)/knowledge");
      }
    } catch (e) {
      if (__DEV__) console.warn("[add] save failed", e);
      showToast("Salvataggio non riuscito. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => safeBack("/(app)/knowledge");

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar
        title="Nuovo ricordo"
        onBack={handleBack}
        rightSlot={
          <Pressable
            onPress={() => doSave(false)}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Salva"
            hitSlop={10}
            onPressIn={() => setSavePressed(true)}
            onPressOut={() => setSavePressed(false)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 8,
              opacity: !canSave ? 0.35 : savePressed ? 0.6 : 1,
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
              Salva
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
          contentContainerStyle={{ paddingBottom: 200 }}
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
              const on = folder === f.kind;
              return (
                <Tappable
                  key={f.kind}
                  onPress={() => {
                    setFolder(f.kind);
                    // Reset the type if it isn't valid for the new folder —
                    // done here (not in an effect) so both states update in
                    // one batched render, with no invalid-type frame.
                    const ts = ITEM_TYPES_BY_KIND[f.kind];
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
                    backgroundColor: on ? colors.navy : colors.surface,
                    borderWidth: on ? 0 : 1,
                    borderColor: colors.hairline,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: on ? FONT.semibold : FONT.medium,
                      fontSize: 14,
                      color: on ? colors.warmWhite : colors.navy,
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
                    · #{priorityOf(f.kind, order)}
                  </Text>
                </Tappable>
              );
            })}
          </ScrollView>

          {/* Campi del ricordo — fronte/retro espliciti (spec core-loop §3) */}
          <View style={{ paddingHorizontal: 18, gap: 10 }}>
            <TextInput
              value={term}
              onChangeText={setTerm}
              placeholder="Termine da ricordare"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Termine"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.hairline,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontFamily: FONT.semibold,
                fontSize: 18,
                color: colors.navy,
                letterSpacing: -0.2,
              }}
            />
            {folder === "jp" ? (
              <TextInput
                value={reading}
                onChangeText={setReading}
                placeholder="Lettura (opzionale) — es. muzukashii"
                placeholderTextColor={colors.placeholder}
                accessibilityLabel="Lettura"
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
              value={definition}
              onChangeText={setDefinition}
              placeholder="Cosa significa?"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Definizione"
              multiline
              textAlignVertical="top"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.hairline,
                padding: 16,
                minHeight: 90,
                fontFamily: FONT.regular,
                fontSize: 16,
                color: colors.navy,
                lineHeight: 22,
                letterSpacing: -0.07,
              }}
            />
            <TextInput
              value={example}
              onChangeText={setExample}
              placeholder="Frase d'esempio (opzionale)"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Frase d'esempio"
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
                    backgroundColor: on ? colors.navy : colors.surface,
                    borderWidth: on ? 0 : 1,
                    borderColor: colors.hairline,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: on ? FONT.semibold : FONT.medium,
                      fontSize: 13,
                      color: on ? colors.warmWhite : colors.navy,
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
                  Fronte
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
                {folder === "jp" && reading.trim() ? (
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
                  Retro
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
                  backgroundColor: "#F7F5F0",
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
                  Primo ripasso · domani, 8:00
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
            Prova a usarlo nella vita reale oggi — il primo ripasso è domani.
          </Text>
        </ScrollView>

        {/* Pinned bottom actions */}
        <View
          style={{
            position: "absolute",
            left: 18,
            right: 18,
            bottom: 24,
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
                ? `Oltre il limite di oggi (${dailyCount}/${dailyMax}) — puoi salvare comunque, ma domani il carico sarà più alto.`
                : `${dailyCount} / ${dailyMax} ricordi oggi`}
          </Text>
          <GhostButton
            label="Salva e aggiungi un altro"
            variant="outline"
            onPress={() => doSave(true)}
            disabled={!canSave}
          />
          <PrimaryButton label="Salva e continua" onPress={() => doSave(false)} disabled={!canSave} />
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}
