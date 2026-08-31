import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { PenLine } from "lucide-react-native";

import { FolderTile } from "@/components/FolderTile";
import { Mascot } from "@/components/Mascot";
import { MascotLoader } from "@/components/MascotLoader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SectionLabel } from "@/components/SectionLabel";
import { Tappable } from "@/components/Tappable";
import { TopBar } from "@/components/TopBar";
import { countFolders, createFolder, fetchFolders, moveMemory } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  FOLDER_LIMIT_ENFORCED,
  FOLDER_NAME_MAX_LENGTH,
  FOLDER_TEMPLATES,
  type TemplateKind,
} from "@/lib/constants";
import {
  folderInputFromChoice,
  validateFolderName,
  type TopicChoice,
} from "@/lib/folder-templates";
import { useT } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { reportError } from "@/lib/report-error";
import { colors, FONT, radii } from "@/theme/tokens";

type Selection = TemplateKind | "custom" | null;

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
 * "Scegli il tuo argomento" — the one-folder onboarding step.
 *
 * Lives in the ROOT stack (like /add) so it is reachable both from the
 * (auth) onboarding carousel and from (app) surfaces: Add and Knowledge
 * send here any signed-in user who owns zero folders instead of silently
 * no-op'ing. A returning user with ≥1 folder is bounced straight to Today.
 *
 * Freemium: exactly one folder — while FOLDER_LIMIT_ENFORCED is true. In the
 * test phase (2026-08-27) Knowledge pushes this screen with `?mode=new`:
 * the owned kinds are greyed out (unique user_id+kind in the DB), and after
 * creating we pop back to Knowledge instead of going to Today.
 */
export default function ChooseTopicScreen() {
  const { t } = useT();
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
  // con una cartella già sua (review 2026-08-31; il gate Premium nasconderà
  // la voce a monte quando arriverà).
  const addingAnother = (mode === "new" && !FOLDER_LIMIT_ENFORCED) || Boolean(moveMemoryId);

  const [checking, setChecking] = useState(true);
  const [ownedKinds, setOwnedKinds] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<Selection>(null);
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Returning user (already has a folder) → skip this step entirely.
  // "Add another" mode instead loads the owned kinds to grey them out.
  useEffect(() => {
    if (!user || adminOnly) return;
    let cancelled = false;
    if (addingAnother) {
      fetchFolders(user.id)
        .then((fs) => {
          if (cancelled) return;
          setOwnedKinds(new Set(fs.map((f) => f.kind)));
          setChecking(false);
        })
        .catch((e) => {
          reportError("choose-topic/fetch-folders", e);
          if (!cancelled) setChecking(false);
        });
      return () => {
        cancelled = true;
      };
    }
    countFolders(user.id)
      .then((n) => {
        if (cancelled) return;
        if (n > 0) {
          goToday();
        } else {
          setChecking(false);
        }
      })
      .catch((e) => {
        // Can't tell — let the user pick; a duplicate kind is refused by
        // the DB (unique user_id+kind) and surfaces as a toast below.
        reportError("choose-topic/count-folders", e);
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, adminOnly, addingAnother]);

  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (adminOnly) return <Redirect href="/(admin)/home" />;

  const customOwned = ownedKinds.has("custom");
  const customValidation = validateFolderName(customName);
  const canCreate =
    !saving &&
    selected !== null &&
    (selected !== "custom" || customValidation.ok);

  const create = async () => {
    if (!selected || saving) return;
    setError(null);
    const choice: TopicChoice =
      selected === "custom"
        ? { type: "custom", name: customName }
        : { type: "template", kind: selected };
    if (choice.type === "custom" && !customValidation.ok) {
      setError(customValidation.message);
      return;
    }
    setSaving(true);
    try {
      const folder = await createFolder(user.id, folderInputFromChoice(choice));
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
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 22 }}>
            <View
              style={{
                width: 132,
                height: 132,
                borderRadius: 999,
                backgroundColor: colors.warmWhite,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Mascot variant="idea" size={112} withShadow={false} />
            </View>
            <Text
              style={{
                marginTop: 22,
                fontFamily: FONT.bold,
                fontSize: 26,
                lineHeight: 32,
                letterSpacing: -0.4,
                color: colors.navy,
                textAlign: "center",
              }}
            >
              {addingAnother ? t("chooseTopic.titleNewFolder") : t("chooseTopic.titleChooseTopic")}
            </Text>
            <Text
              style={{
                marginTop: 10,
                fontFamily: FONT.regular,
                fontSize: 14.5,
                lineHeight: 22,
                color: colors.midGrey,
                textAlign: "center",
                maxWidth: 320,
              }}
            >
              {addingAnother
                ? t("chooseTopic.subtitleNewFolder")
                : FOLDER_LIMIT_ENFORCED
                  ? t("chooseTopic.subtitleLimitEnforced")
                  : t("chooseTopic.subtitleLimitOff")}
            </Text>
          </View>

          <SectionLabel>{t("chooseTopic.sectionTemplates")}</SectionLabel>

          {/* 2×2 template grid */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 10,
            }}
          >
            {FOLDER_TEMPLATES.map((tpl) => {
              const on = selected === tpl.kind;
              const owned = ownedKinds.has(tpl.kind);
              return (
                <Tappable
                  key={tpl.kind}
                  onPress={() => {
                    if (owned) return;
                    setSelected(tpl.kind);
                    setError(null);
                  }}
                  disabled={owned}
                  accessibilityRole="button"
                  accessibilityLabel={
                    owned
                      ? t("chooseTopic.templateOwnedLabel", { name: tpl.name })
                      : t("chooseTopic.templateLabel", { name: tpl.name, hint: tpl.hint })
                  }
                  accessibilityState={{ selected: on, disabled: owned }}
                  pressedOpacity={0.8}
                  containerStyle={{ width: "48%", flexGrow: 1, opacity: owned ? 0.45 : 1 }}
                  style={{
                    borderRadius: radii.card,
                    backgroundColor: on ? colors.tagUserBg : colors.surface,
                    borderWidth: on ? 1.5 : 1,
                    borderColor: on ? colors.navy : colors.hairline,
                    padding: 14,
                    gap: 10,
                    minHeight: 112,
                  }}
                >
                  <FolderTile kind={tpl.kind} size={36} />
                  <View>
                    <Text
                      style={{
                        fontFamily: FONT.semibold,
                        fontSize: 15.5,
                        color: colors.navy,
                        letterSpacing: -0.15,
                      }}
                    >
                      {tpl.name}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        marginTop: 2,
                        fontFamily: FONT.regular,
                        fontSize: 12.5,
                        lineHeight: 17,
                        color: colors.midGrey,
                      }}
                    >
                      {owned ? t("chooseTopic.alreadyOwned") : tpl.hint}
                    </Text>
                  </View>
                </Tappable>
              );
            })}
          </View>

          <SectionLabel topMargin={22}>{t("chooseTopic.sectionOr")}</SectionLabel>

          {/* "Altro…" — custom folder name */}
          <Tappable
            onPress={() => {
              if (customOwned) return;
              setSelected("custom");
              setError(null);
            }}
            disabled={customOwned}
            accessibilityRole="button"
            accessibilityLabel={customOwned ? t("chooseTopic.customOwnedLabel") : t("chooseTopic.customLabel")}
            accessibilityState={{ selected: selected === "custom", disabled: customOwned }}
            pressedOpacity={0.85}
            containerStyle={{ marginTop: 10, opacity: customOwned ? 0.45 : 1 }}
            style={{
              borderRadius: radii.card,
              backgroundColor: selected === "custom" ? colors.tagUserBg : colors.surface,
              borderWidth: selected === "custom" ? 1.5 : 1,
              borderColor: selected === "custom" ? colors.navy : colors.hairline,
              padding: 14,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  backgroundColor: colors.warmWhite,
                  borderWidth: 1.2,
                  borderColor: colors.hairlineStrong,
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PenLine size={18} color={colors.navy} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 15.5,
                    color: colors.navy,
                    letterSpacing: -0.15,
                  }}
                >
                  {t("chooseTopic.other")}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: FONT.regular,
                    fontSize: 12.5,
                    lineHeight: 17,
                    color: colors.midGrey,
                  }}
                >
                  {customOwned
                    ? t("chooseTopic.customAlreadyOwned")
                    : t("chooseTopic.customHint")}
                </Text>
              </View>
            </View>

            {selected === "custom" ? (
              <View>
                <TextInput
                  value={customName}
                  onChangeText={(v) => {
                    setCustomName(v);
                    setError(null);
                  }}
                  autoFocus
                  autoCapitalize="sentences"
                  maxLength={FOLDER_NAME_MAX_LENGTH + 10}
                  placeholder={t("chooseTopic.folderNamePlaceholder")}
                  placeholderTextColor={colors.placeholder}
                  accessibilityLabel={t("chooseTopic.folderNamePlaceholder")}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (canCreate) void create();
                  }}
                  style={{
                    height: 50,
                    borderRadius: radii.input,
                    backgroundColor: colors.surface,
                    borderWidth: 1.5,
                    borderColor: colors.navy,
                    paddingHorizontal: 14,
                    fontFamily: FONT.medium,
                    fontSize: 16,
                    color: colors.navy,
                  }}
                />
                <Text
                  style={{
                    marginTop: 6,
                    alignSelf: "flex-end",
                    fontFamily: FONT.regular,
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
          </Tappable>

          {error ? (
            <View
              className="mt-4 self-start rounded-chip px-3 py-2"
              style={{ backgroundColor: colors.dangerSoft }}
            >
              <Text
                style={{ fontFamily: FONT.medium, fontSize: 12.5, color: colors.danger }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          <View style={{ marginTop: 26 }}>
            <PrimaryButton
              label={t("chooseTopic.createFolder")}
              onPress={create}
              loading={saving}
              disabled={!canCreate}
            />
          </View>
          <Text
            style={{
              marginTop: 12,
              fontFamily: FONT.regular,
              fontSize: 12.5,
              lineHeight: 18,
              color: colors.midGrey,
              textAlign: "center",
            }}
          >
            {t("chooseTopic.renameLaterHint")}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
