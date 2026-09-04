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
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Camera, Plus } from "lucide-react-native";

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
import { countMemories, createMemory, fetchProfile, fetchTodayInputCount } from "@/lib/api";
import { useFoldersWithStats } from "@/lib/use-folders";
import type { FolderWithStats, Memory, Profile } from "@/lib/mappers";
import { useAuthStore } from "@/lib/auth-store";
import { useUIStore } from "@/lib/ui-store";
import { errorCode, reportError } from "@/lib/report-error";
import {
  PLAN_LIMITS,
  canAddMemory,
  canUsePhotos,
  planLimitFromCode,
  type PlanLimitKind,
} from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";
import { safeBack } from "@/lib/safe-back";
import { consumeIntentionalAddOpen } from "@/lib/add-gate";
import { useT } from "@/lib/i18n";
import { shortDateTime } from "@/lib/format";
import { firstReview } from "@/features/srs/phases";
import { itemTypesFor, legacyKindFor, templateHasReading } from "@/lib/folder-taxonomy";
import { MascotDialog } from "@/components/MascotDialog";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";
import { useNotificationPrefsStore } from "@/lib/notification-prefs-store";
import {
  getPermission,
  notificationsAvailable,
  requestPermission,
  scheduleFirstReview,
  syncDailyReminder,
} from "@/lib/notifications";
import { MemoryPhoto } from "@/components/MemoryPhoto";
import { PhotoSheet } from "@/components/PhotoSheet";
import {
  pickPhoto,
  resizeForUpload,
  uploadMemoryPhoto,
  type PhotoSource,
} from "@/lib/photos";

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
  const plan = usePlan();
  // Totale dei ricordi dell'account, CESTINO COMPRESO (stesso predicato del
  // trigger): e' il contatore del piano free (10 in tutto), diverso dal
  // contatore giornaliero, che resta l'autoregolazione di Pro/Premium.
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [planBlock, setPlanBlock] = useState<PlanLimitKind | null>(null);
  // Profilo intero, non solo il tetto: serve per riallineare il promemoria
  // giornaliero appena il permesso viene concesso.
  const [profile, setProfile] = useState<Profile | null>(null);
  // Permesso notifiche: si chiede DOPO il primo ricordo salvato su questo
  // telefono, mai all'avvio (spec F3). Pre-caricato qui così dopo il
  // salvataggio la decisione è sincrona. Il dialogo trattiene il ricordo
  // appena salvato: la notifica si programma solo a permesso concesso.
  const promptSeen = useNotificationPrefsStore((s) => s.prefs.promptSeen);
  const notifEnabled = useNotificationPrefsStore((s) => s.prefs.enabled);
  const setPrefs = useNotificationPrefsStore((s) => s.setPrefs);
  const [canOfferPrompt, setCanOfferPrompt] = useState(false);
  const [notifPrompt, setNotifPrompt] = useState<{ memory: Memory; addAnother: boolean } | null>(null);
  // Doppio tap sul dialogo: `notifPrompt` si azzera solo DOPO il foglio di
  // sistema (parecchi giri nativi), quindi la guardia sullo stato non ferma
  // il secondo tap — il dialogo resta toccabile per tutta l'attesa. Questo
  // ref si alza in modo SINCRONO nel gesto, come `saving` fa per doSave:
  // senza, due tap chiedono il permesso due volte e chiamano `safeBack`
  // due volte, chiudendo anche la schermata sotto la modale. È condiviso
  // dai due gesti, così vale anche per "Sì" seguito subito da "Non ora".
  const promptBusy = useRef(false);
  const showToast = useUIStore((s) => s.showToast);
  const { t } = useT();
  // Foto sul retro (Premium). Fino al salvataggio è solo un file locale, già
  // ridimensionato alla scelta: il CARICAMENTO parte dopo che la riga esiste,
  // perché il path contiene memory_id — e chi abbandona la schermata non
  // lascia file orfani nel bucket.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  // iOS: la sorgente scelta resta in attesa finché il foglio non ha FINITO di
  // chiudersi (vedi requestPick). Su Android è sempre null.
  const [pendingSource, setPendingSource] = useState<PhotoSource | null>(null);
  const [premiumAsk, setPremiumAsk] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([fetchTodayInputCount(user.id), fetchProfile(user.id), countMemories(user.id)])
      .then(([count, profile, total]) => {
        if (cancelled) return;
        setDailyCount(count);
        setTotalCount(total);
        if (profile) {
          setDailyMax(profile.dailyInputCap);
          setProfile(profile);
        }
      })
      .catch((e) => {
        reportError("add/daily-count-load", e);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!notificationsAvailable() || promptSeen) {
      setCanOfferPrompt(false);
      return;
    }
    let cancelled = false;
    getPermission().then((p) => {
      // Il cancello NON può essere solo `undetermined`: su Android con
      // SDK_INT < 33 (Android 12 e giù, e il minSdk di Expo 54 è 24) il
      // modulo prende il ramo "classic" e mappa areNotificationsEnabled()
      // in GRANTED o DENIED — `undetermined` non arriva MAI
      // (node_modules/expo-notifications/android/src/main/java/expo/modules/
      // notifications/permissions/NotificationPermissionsModule.kt:36,91-112).
      // Lì il permesso di sistema c'è già ma l'interruttore di Memika no, e
      // senza dialogo `prefs.enabled` resterebbe false per sempre: nessuna
      // notifica, mai, su un intero intervallo di versioni Android. Il
      // dialogo serve a portare `enabled` a true, non solo a chiedere all'OS.
      if (!cancelled) setCanOfferPrompt(p.undetermined || (p.allowed && !notifEnabled));
    });
    return () => {
      cancelled = true;
    };
  }, [promptSeen, notifEnabled]);

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
  const totalMax = PLAN_LIMITS[plan].memories;
  // Il tetto totale del piano e' un AVVISO, non un blocco lato client: il
  // rifiuto lo pronuncia il trigger (P0004) e il catch di doSave lo traduce
  // nello stesso dialogo. Un `return` preventivo qui sarebbe un blocco vero
  // appoggiato a un valore che si degrada da solo: se la lettura di
  // `profiles` fallisce, buildAuthUserFromSession ripiega su `plan: "free"`
  // (lib/auth-store.ts) e nella build 3 non esiste riparazione — senza
  // chiavi RevenueCat `startPlanSync` non chiama mai `refreshPlan`, e
  // `hydrate()` gira una volta sola. Un abbonato che apre l'app offline si
  // troverebbe murato fuori da Add fino al riavvio.
  const planLimitReached = totalMax !== null && !canAddMemory(totalCount ?? 0, plan);
  // "Salva e aggiungi un altro": campi puliti, si resta qui.
  const clearFields = () => {
    setTerm("");
    setReading("");
    setDefinition("");
    setExample("");
    // La foto è contenuto del ricordo, non contesto di sessione: se restasse,
    // il salvataggio dopo la caricherebbe sotto un altro memory_id.
    setPhotoUri(null);
  };

  // Dopo il dialogo si riprende da dove il salvataggio si era fermato.
  const finishPrompt = (addAnother: boolean) => {
    setNotifPrompt(null);
    if (addAnother) termRef.current?.focus();
    else safeBack("/(app)/knowledge");
  };

  const acceptPrompt = async () => {
    if (!notifPrompt || promptBusy.current) return;
    promptBusy.current = true;
    const { memory, addAnother } = notifPrompt;
    setPrefs({ promptSeen: true });
    const perm = await requestPermission();
    if (perm.allowed) {
      setPrefs({ enabled: true });
      await scheduleFirstReview(memory);
      void syncDailyReminder(profile);
    }
    finishPrompt(addAnother);
  };

  // "Non ora" NON chiama il permesso di sistema: resta chiedibile dalla
  // schermata Notifiche. Il flag evita di riproporre il dialogo.
  const declinePrompt = () => {
    if (!notifPrompt || promptBusy.current) return;
    promptBusy.current = true;
    setPrefs({ promptSeen: true });
    finishPrompt(notifPrompt.addAnother);
  };

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
      const saved = await createMemory({
        userId: user.id,
        folderId: folderRow.id,
        term: term.trim(),
        reading: showReading && reading.trim() ? reading.trim() : undefined,
        definition: definition.trim(),
        example: example.trim() ? example.trim() : undefined,
        itemType: type,
      });
      setDailyCount((c) => (c ?? 0) + 1);
      setTotalCount((c) => (c ?? 0) + 1);
      // La foto si carica DOPO che la riga esiste. photoUri è già il JPEG
      // ridimensionato dalla scelta: qui si leggono solo i byte. Se il
      // caricamento fallisce la riga resta e si avvisa — perdere il testo per
      // colpa di una foto sarebbe il peggiore dei due esiti. In demo
      // createMemory è null: niente upload.
      let photoFailed = false;
      if (saved && photoUri) {
        try {
          await uploadMemoryPhoto(user.id, saved.id, photoUri);
        } catch (e) {
          reportError("add/photo-upload", e);
          photoFailed = true;
        }
      }
      showToast(
        photoFailed
          ? t("add.photoUploadFailed", { name: folderRow.name })
          : t("add.savedToast", { name: folderRow.name }),
      );
      if (saved && canOfferPrompt) {
        // Il dialogo è un Modal DENTRO questa schermata: la navigazione
        // aspetta la risposta, altrimenti lo smonterebbe.
        if (addAnother) clearFields();
        setCanOfferPrompt(false);
        promptBusy.current = false;
        setNotifPrompt({ memory: saved, addAnother });
        return;
      }
      // Notifica "primo ripasso pronto" a T0+20h — no-op senza permesso,
      // senza interruttore o con "Avvisami" spento.
      if (saved) void scheduleFirstReview(saved);
      if (addAnother) {
        // Keep the fields cleared for fast successive adds; no nav.
        clearFields();
        termRef.current?.focus();
      } else {
        // Toast is rendered at the root layout — it survives this unmount.
        // safeBack dismisses the keyboard first to avoid an Android race that
        // leaves the IME attached to the unmounted TextInput.
        safeBack("/(app)/knowledge");
      }
    } catch (e) {
      const limit = planLimitFromCode(errorCode(e));
      if (limit) {
        setPlanBlock(limit);
        return;
      }
      reportError("add/save", e);
      showToast(t("add.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const openPhotoSheet = () => {
    if (!canUsePhotos(plan)) {
      // Free/Pro: la mascotte spiega e propone l'upgrade (spec: "disabilita,
      // spiega, propone l'upgrade"), il bottone resta visibile.
      setPremiumAsk(true);
      return;
    }
    setPhotoSheetOpen(true);
  };

  const handlePickPhoto = async (source: PhotoSource) => {
    try {
      const outcome = await pickPhoto(source);
      if (outcome.status === "denied") {
        showToast(t("add.photoPermissionDenied"));
        return;
      }
      if (outcome.status !== "picked") return;
      // Ridimensiona SUBITO: l'anteprima mostra il file piccolo (un originale
      // da 12 MP decodificato costa ~48 MB, e <Image> lo decodifica intero
      // anche in un box da 240) e il salvataggio non ricodifica più niente.
      const jpeg = await resizeForUpload(outcome.uri);
      setPhotoUri(jpeg.uri);
    } catch (e) {
      reportError("add/photo-pick", e);
      showToast(t("add.photoPickFailed"));
    }
  };

  const requestPick = (source: PhotoSource) => {
    // Chiudere il foglio PRIMA di aprire il picker. `setPhotoSheetOpen(false)`
    // NON chiude il Modal in modo sincrono (l'animazione dura ~300 ms) e /add
    // è già presentato come modal su iOS (app/_layout.tsx:344): un picker
    // presentato sopra un Modal ancora vivo viene rifiutato da UIKit e non
    // compare mai. Su iOS quindi si aspetta onDismiss del Modal; su Android il
    // Modal è un Dialog e non c'è conflitto di presentazione.
    setPhotoSheetOpen(false);
    if (Platform.OS === "ios") setPendingSource(source);
    else void handlePickPhoto(source);
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
            {/* Il "+" per la foto vive DENTRO il box del significato, in basso a
                destra (spec §B5): quel box È il retro della card, e la foto va
                sul retro. paddingBottom 44 tiene il testo sopra il bottone
                anche a tre righe; senza, scorrerebbe sotto. */}
            <View style={{ position: "relative" }}>
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
                  paddingBottom: 44,
                  minHeight: 90,
                  fontFamily: FONT.regular,
                  fontSize: 16,
                  color: colors.navy,
                  lineHeight: 22,
                  letterSpacing: -0.07,
                }}
              />
              {/* Bloccato durante il salvataggio come i due bottoni in fondo
                  (:900-905): doSave legge `photoUri` dalla closure prima
                  dell'upload e poi clearFields() lo azzera — una foto scelta
                  mentre l'attesa è in corso (fino a 15 s di timeout) andrebbe
                  persa senza caricare niente e senza avviso. */}
              <Tappable
                onPress={openPhotoSheet}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={photoUri ? t("add.photoChange") : t("add.photoAdd")}
                pressedOpacity={0.6}
                hitSlop={6}
                containerStyle={{ position: "absolute", right: 8, bottom: 8 }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: photoUri ? colors.accent : colors.canvas,
                  borderWidth: photoUri ? 0 : 1,
                  borderColor: colors.hairline,
                }}
              >
                {photoUri ? (
                  <Camera size={18} color={colors.onAccent} strokeWidth={2} />
                ) : (
                  <Plus size={20} color={colors.navy} strokeWidth={2} />
                )}
              </Tappable>
            </View>
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
                {photoUri ? <MemoryPhoto localUri={photoUri} style={{ marginTop: 10 }} /> : null}
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
              fontFamily: dailyLimitReached || planLimitReached ? FONT.medium : FONT.regular,
              fontSize: dailyLimitReached || planLimitReached ? 12.5 : 12,
              color: dailyLimitReached || planLimitReached ? colors.danger : colors.midGrey,
              fontVariant: ["tabular-nums"],
              textAlign: "center",
              paddingHorizontal: 8,
            }}
          >
            {totalMax !== null
              ? totalCount === null
                ? "…"
                : planLimitReached
                  ? t("add.totalLimitReached", { max: totalMax })
                  : t("add.totalCounter", { count: totalCount, max: totalMax })
              : dailyCount === null
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

      <PhotoSheet
        visible={photoSheetOpen}
        hasPhoto={photoUri !== null}
        onPick={requestPick}
        onDismissed={() => {
          // iOS: il foglio è chiuso davvero, ora il picker può presentarsi.
          const source = pendingSource;
          setPendingSource(null);
          if (source) void handlePickPhoto(source);
        }}
        onRemove={() => {
          setPhotoUri(null);
          setPhotoSheetOpen(false);
        }}
        onClose={() => setPhotoSheetOpen(false)}
      />
      {/* Free/Pro: la mascotte spiega e manda al paywall (B4). Il Modal si
          chiude PRIMA del push, come settings.tsx:164-165 fa con lo stato. */}
      <MascotDialog
        visible={premiumAsk}
        title={t("add.photoPremiumTitle")}
        body={t("add.photoPremiumBody")}
        confirmLabel={t("add.photoPremiumConfirm")}
        cancelLabel={t("add.photoPremiumCancel")}
        onConfirm={() => {
          setPremiumAsk(false);
          router.push("/paywall" as never);
        }}
        onCancel={() => setPremiumAsk(false)}
      />

      {/* Pre-prompt del permesso: solo al primo salvataggio su questo telefono. */}
      <MascotDialog
        visible={notifPrompt !== null}
        title={t("notifications.promptTitle")}
        body={t("notifications.promptBody")}
        confirmLabel={t("notifications.promptConfirm")}
        cancelLabel={t("notifications.promptCancel")}
        onConfirm={() => void acceptPrompt()}
        onCancel={declinePrompt}
      />

      <PlanLimitDialog limit={planBlock} plan={plan} onClose={() => setPlanBlock(null)} />
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
