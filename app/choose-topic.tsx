import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { PenLine, Search } from "lucide-react-native";

import { Mascot } from "@/components/Mascot";
import { MascotLoader } from "@/components/MascotLoader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Tappable } from "@/components/Tappable";
import { TopBar } from "@/components/TopBar";
import { countFolders, createFolder, moveMemory } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/constants";
import { planLimitFromCode, type PlanLimitKind } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";
import {
  folderInputFromCustomName,
  folderInputFromSubcategory,
  validateFolderName,
  type NewFolderInput,
} from "@/lib/folder-templates";
import {
  CUSTOM_FOLDER_EMOJI,
  TAXONOMY,
  filterSubcategories,
  type TaxonomyCategory,
  type TaxonomySub,
} from "@/lib/folder-taxonomy";
import { useT } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { errorCode, reportError } from "@/lib/report-error";
import { FONT, radii, useColors } from "@/theme/tokens";

/**
 * La scelta corrente: una sottocategoria della tassonomia, oppure un nome
 * libero (da "Altra lingua…" — che resta nella sua macrocategoria — o dal
 * box "Crea cartella personalizzata").
 */
type Selection =
  | { type: "sub"; category: TaxonomyCategory; sub: TaxonomySub }
  | { type: "free"; category: TaxonomyCategory | null }
  | null;

/**
 * Leaves this screen for Today. This route sits in the ROOT stack on top of
 * the `(app)` group when reached from Knowledge (push) or Add (redirect);
 * `router.replace("/(app)/today")` from there would REPLACE the focused
 * root route with a SECOND `(app)` instance — two Tabs navigators alive,
 * and Android back landing on the stale zero-folder Knowledge underneath.
 * Popping back to the existing `(app)` keeps a single instance; the plain
 * replace is only for the onboarding path, where nothing is below us.
 */
function goToday() {
  if (router.canGoBack()) {
    router.dismissTo("/(app)/today");
  } else {
    router.replace("/(app)/today");
  }
}

/**
 * "Cosa vuoi ricordare?" — la scelta dell'argomento (Maurizio 2026-09-01).
 *
 * Quattro macrocategorie (Lingue, Materie, Lavoro, Interessi): il tocco
 * apre un selettore a tendina con ricerca sulle sottocategorie. In fondo,
 * il box "Crea cartella personalizzata" per un nome libero.
 *
 * Lives in the ROOT stack (like /add) so it is reachable both from the
 * (auth) onboarding carousel and from (app) surfaces: Add and Knowledge
 * send here any signed-in user who owns zero folders instead of silently
 * no-op'ing. A returning user with ≥1 folder is bounced straight to Today.
 */
export default function ChooseTopicScreen() {
  const colors = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  // An admin browsing the consumer app ("Apri l'app come utente") may own
  // zero folders too; without this the Add → /choose-topic redirect would
  // bounce them straight back to the admin shell.
  const viewAsUser = useAuthStore((s) => s.viewAsUser);
  const adminOnly = user?.role === "admin" && !viewAsUser;
  const showToast = useUIStore((s) => s.showToast);
  const { mode, moveMemoryId } = useLocalSearchParams<{ mode?: string; moveMemoryId?: string }>();
  // Il flusso "Nuova cartella…" del MoveSheet (moveMemoryId) non deve MAI
  // rimbalzare su Oggi: anche a limite freemium attivo l'utente arriva qui
  // con una cartella già sua (review 2026-08-31; il gate del piano vive a
  // monte, in Cartelle, e qui la doppia cintura è l'errcode del trigger).
  const addingAnother = mode === "new" || Boolean(moveMemoryId);

  const [checking, setChecking] = useState(!addingAnother);
  const [selection, setSelection] = useState<Selection>(null);
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const plan = usePlan();
  const [planBlock, setPlanBlock] = useState<PlanLimitKind | null>(null);
  /** Macrocategoria col selettore aperto; null = chiuso. */
  const [openCategory, setOpenCategory] = useState<TaxonomyCategory | null>(null);
  const [query, setQuery] = useState("");

  // Returning user (already has a folder) → skip this step entirely.
  // In "add another" mode there is nothing to preload: duplicates are legal
  // since the unique(user_id, kind) constraint was dropped (2026-09-02).
  useEffect(() => {
    if (!user || adminOnly || addingAnother) return;
    let cancelled = false;
    countFolders(user.id)
      .then((n) => {
        if (cancelled) return;
        if (n > 0) goToday();
        else setChecking(false);
      })
      .catch((e) => {
        reportError("choose-topic/count-folders", e);
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, adminOnly, addingAnother]);

  const filtered = useMemo(
    () => (openCategory ? filterSubcategories(openCategory.subcategories, query) : []),
    [openCategory, query],
  );

  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (adminOnly) return <Redirect href="/(admin)/home" />;

  const isFree = selection?.type === "free";
  const customValidation = validateFolderName(customName);
  const canCreate = !saving && selection !== null && (!isFree || customValidation.ok);

  const create = async () => {
    if (!selection || saving) return;
    setError(null);
    let input: NewFolderInput;
    if (selection.type === "sub") {
      input = folderInputFromSubcategory(selection.category.id, selection.sub);
    } else {
      if (!customValidation.ok) {
        setError(customValidation.message);
        return;
      }
      input = folderInputFromCustomName(
        customName,
        selection.category?.id ?? "custom",
        selection.category?.emoji ?? CUSTOM_FOLDER_EMOJI,
      );
    }
    setSaving(true);
    try {
      const folder = await createFolder(user.id, input);
      // Arrivati dal foglio "Sposta" (MoveSheet): la parola segue subito la
      // cartella appena creata; un fallimento non blocca la creazione.
      if (moveMemoryId) {
        try {
          await moveMemory(moveMemoryId, { folderId: folder.id });
          showToast(t("move.moved", { name: folder.name }));
        } catch (moveErr) {
          reportError("choose-topic/move-memory", moveErr);
          showToast(t("move.failed"));
        }
      } else {
        showToast(t("chooseTopic.folderReadyToast", { name: folder.name }));
      }
      if (addingAnother && router.canGoBack()) {
        router.back(); // Knowledge refetches on focus
      } else {
        goToday();
      }
    } catch (e) {
      const limit = planLimitFromCode(errorCode(e));
      if (limit) {
        setPlanBlock(limit);
        return;
      }
      reportError("choose-topic/create-folder", e);
      setError(t("chooseTopic.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MascotLoader label={t("common.oneMoment")} />
        </View>
      </SafeAreaView>
    );
  }

  const subtitle = addingAnother
    ? t("chooseTopic.subtitleNewFolder")
    : plan === "free"
      ? t("chooseTopic.subtitleLimitEnforced")
      : t("chooseTopic.subtitleLimitOff");

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      {/* Reached from Knowledge: give the user a way back (Angelo, 2026-08-27). */}
      {addingAnother ? (
        <TopBar onBack={() => (router.canGoBack() ? router.back() : goToday())} />
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: "center", paddingTop: addingAnother ? 4 : 16, paddingBottom: 18 }}>
            <Mascot variant="idea" size={84} withShadow={false} />
            <Text
              accessibilityRole="header"
              style={{
                marginTop: 10,
                fontFamily: FONT.bold,
                fontSize: 26,
                lineHeight: 32,
                color: colors.navy,
                letterSpacing: -0.6,
                textAlign: "center",
              }}
            >
              {addingAnother ? t("chooseTopic.titleNewFolder") : t("chooseTopic.titleChooseTopic")}
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontFamily: FONT.regular,
                fontSize: 14.5,
                lineHeight: 20,
                color: colors.midGrey,
                textAlign: "center",
                paddingHorizontal: 12,
              }}
            >
              {subtitle}
            </Text>
          </View>

          {/* Le quattro macrocategorie, 2×2. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {TAXONOMY.map((cat) => {
              const active =
                (selection?.type === "sub" && selection.category.id === cat.id) ||
                (selection?.type === "free" && selection.category?.id === cat.id);
              const chosenSub = selection?.type === "sub" && selection.category.id === cat.id
                ? selection.sub
                : null;
              return (
                <Tappable
                  key={cat.id}
                  accessibilityRole="button"
                  accessibilityLabel={cat.name}
                  accessibilityHint={cat.hint}
                  onPress={() => {
                    setQuery("");
                    setOpenCategory(cat);
                  }}
                  pressedOpacity={0.85}
                  containerStyle={{ width: "48%", flexGrow: 1 }}
                  style={{
                    minHeight: 116,
                    backgroundColor: colors.surface,
                    borderRadius: radii.card,
                    borderWidth: active ? 1.5 : 1,
                    borderColor: active ? colors.accent : colors.hairline,
                    padding: 14,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 28 }}>{cat.emoji}</Text>
                  <Text
                    style={{
                      fontFamily: FONT.bold,
                      fontSize: 16.5,
                      color: colors.navy,
                      letterSpacing: -0.2,
                    }}
                  >
                    {cat.name}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontFamily: FONT.regular,
                      fontSize: 12.5,
                      lineHeight: 17,
                      color: colors.midGrey,
                    }}
                  >
                    {chosenSub ? `${chosenSub.emoji} ${chosenSub.name}` : cat.hint}
                  </Text>
                </Tappable>
              );
            })}
          </View>

          {/* Box "Crea cartella personalizzata". */}
          <Tappable
            accessibilityRole="button"
            accessibilityLabel={t("taxonomy.customBoxTitle")}
            onPress={() => {
              setSelection({ type: "free", category: null });
              setCustomName("");
              setError(null);
            }}
            pressedOpacity={0.85}
            containerStyle={{ marginTop: 14 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: colors.surface,
              borderRadius: radii.card,
              borderWidth: selection?.type === "free" && !selection.category ? 1.5 : 1,
              borderColor:
                selection?.type === "free" && !selection.category ? colors.accent : colors.hairline,
              padding: 14,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                borderWidth: 1.2,
                borderStyle: "dashed",
                borderColor: colors.hairlineStrong,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PenLine size={18} color={colors.navy} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: FONT.semibold, fontSize: 15.5, color: colors.navy }}>
                {t("taxonomy.customBoxTitle")}
              </Text>
              <Text style={{ fontFamily: FONT.regular, fontSize: 12.5, color: colors.midGrey }}>
                {t("taxonomy.customBoxSubtitle")}
              </Text>
            </View>
          </Tappable>

          {/* Nome libero: compare per "Altra lingua…" e per il box custom. */}
          {isFree ? (
            <View style={{ marginTop: 12, gap: 6 }}>
              <TextInput
                autoFocus
                value={customName}
                onChangeText={(v) => {
                  setCustomName(v);
                  setError(null);
                }}
                placeholder={t("chooseTopic.folderNamePlaceholder")}
                placeholderTextColor={colors.placeholder}
                maxLength={FOLDER_NAME_MAX_LENGTH + 10}
                style={{
                  height: 50,
                  backgroundColor: colors.surface,
                  borderRadius: radii.chip,
                  borderWidth: 1.5,
                  borderColor: colors.accent,
                  paddingHorizontal: 14,
                  fontFamily: FONT.semibold,
                  fontSize: 16,
                  color: colors.navy,
                }}
              />
              <Text
                style={{
                  alignSelf: "flex-end",
                  fontFamily: FONT.medium,
                  fontSize: 11.5,
                  color:
                    customName.trim().length > FOLDER_NAME_MAX_LENGTH
                      ? colors.danger
                      : colors.midGrey,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {customName.trim().length} / {FOLDER_NAME_MAX_LENGTH}
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text
              style={{
                marginTop: 8,
                fontFamily: FONT.medium,
                fontSize: 12.5,
                color: colors.danger,
              }}
            >
              {error}
            </Text>
          ) : null}

          <View style={{ flex: 1 }} />

          <View style={{ marginTop: 20, gap: 8 }}>
            <PrimaryButton
              label={t("chooseTopic.createFolder")}
              onPress={create}
              disabled={!canCreate}
              loading={saving}
            />
            <Text
              style={{
                textAlign: "center",
                fontFamily: FONT.regular,
                fontSize: 12,
                color: colors.midGrey,
              }}
            >
              {t("chooseTopic.renameLaterHint")}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Selettore delle sottocategorie — bottom sheet con ricerca. */}
      <Modal
        visible={openCategory !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenCategory(null)}
      >
        {/* Backdrop e sheet sono FRATELLI: RN Pressable ignora stopPropagation
            sintetico (stesso pattern di NamePromptModal/MoveSheet). */}
        <Pressable
          accessibilityLabel={t("common.close")}
          onPress={() => setOpenCategory(null)}
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
              maxHeight: "72%",
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
                fontSize: 19,
                color: colors.navy,
                letterSpacing: -0.3,
                marginBottom: 10,
              }}
            >
              {openCategory ? `${openCategory.emoji} ${openCategory.name}` : ""}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: colors.surface,
                borderRadius: radii.chip,
                borderWidth: 1,
                borderColor: colors.hairline,
                paddingHorizontal: 12,
                height: 44,
                marginBottom: 8,
              }}
            >
              <Search size={16} color={colors.midGrey} strokeWidth={2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("taxonomy.searchPlaceholder")}
                placeholderTextColor={colors.placeholder}
                accessibilityLabel={t("taxonomy.searchPlaceholder")}
                style={{
                  flex: 1,
                  fontFamily: FONT.regular,
                  fontSize: 15,
                  color: colors.navy,
                  padding: 0,
                }}
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {filtered.map((s) => (
                <Tappable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={s.name}
                  onPress={() => {
                    if (!openCategory) return;
                    setSelection({ type: "sub", category: openCategory, sub: s });
                    setCustomName("");
                    setError(null);
                    setOpenCategory(null);
                  }}
                  pressedOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 13,
                    paddingHorizontal: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.hairline,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
                  <Text style={{ fontFamily: FONT.semibold, fontSize: 15.5, color: colors.navy }}>
                    {s.name}
                  </Text>
                </Tappable>
              ))}

              {/* "Altra lingua…" — nome libero che resta nella macrocategoria. */}
              <Tappable
                accessibilityRole="button"
                accessibilityLabel={openCategory?.otherLabel ?? ""}
                onPress={() => {
                  if (!openCategory) return;
                  setSelection({ type: "free", category: openCategory });
                  setCustomName("");
                  setError(null);
                  setOpenCategory(null);
                }}
                pressedOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 13,
                  paddingHorizontal: 6,
                }}
              >
                <PenLine size={18} color={colors.midGrey} strokeWidth={1.8} />
                <Text style={{ fontFamily: FONT.semibold, fontSize: 15.5, color: colors.midGrey }}>
                  {openCategory?.otherLabel ?? ""}
                </Text>
              </Tappable>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <PlanLimitDialog limit={planBlock} plan={plan} onClose={() => setPlanBlock(null)} />
    </SafeAreaView>
  );
}
