import { useEffect, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { Redirect } from "expo-router";

import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { Tappable } from "@/components/Tappable";
import { useAuthStore } from "@/lib/auth-store";
import { useT } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { reportError } from "@/lib/report-error";
import { isDemoMode } from "@/lib/supabase";
import { PRIVACY_URL, TERMS_URL } from "@/lib/constants";
import {
  PLANS,
  hasPeriodChoice,
  pickPlanPackage,
  yearlySavingsPercent,
  type BillingPeriod,
  type Plan,
} from "@/lib/plan";
import { PLAN_NAME_KEY, refreshPlan, usePlan } from "@/lib/use-plan";
import {
  loadPlanPackages,
  purchaseOutcomeFromError,
  purchasePlan,
  purchasesAvailable,
  restorePlan,
  type PlanPackage,
} from "@/lib/purchases";
import { FONT, radii, useColors } from "@/theme/tokens";

/**
 * Il paywall: tre schede, i prezzi veri di RevenueCat, un selettore
 * Mensile/Annuale sopra le schede e un solo bottone per piano.
 *
 * Vive nello stack ROOT come /add, /trash e /folder-settings: ci si arriva
 * sia da Impostazioni e da /folder/[id] (dentro i tab) sia da /add,
 * /choose-topic e /folder-settings (fuori dai tab), e una rotta di (app)
 * spinta da una schermata root creerebbe una SECONDA istanza del navigatore
 * a tab (choose-topic.tsx:52-60). Di conseguenza qui la tab bar non c'e' e
 * il piede legale — obbligatorio su una schermata di abbonamento, Apple
 * 3.1.2 — non rischia di finirci sotto.
 *
 * Il selettore compare SOLO quando l'offerta porta sia un mensile sia un
 * annuale (design approvato da Angelo il 7/9/2026): l'annuale e'
 * preselezionato, ogni scheda mostra il prezzo del pacchetto che comprerebbe
 * con "pari a X al mese" e la pillola del risparmio. Con i soli mensili la
 * schermata e' identica a prima, senza segmenti spenti: su iOS un controllo
 * che non fa niente e' la funzionalita' segnaposto che la linea guida 2.1
 * fa rifiutare.
 *
 * Quando gli acquisti non sono disponibili (Expo Go, demo, chiavi vuote,
 * prodotti non ancora approvati dagli store) le schede restano visibili con
 * i bottoni spenti e una riga che dice perche': mai una schermata vuota,
 * mai un bottone che non fa niente in silenzio.
 */
export default function PaywallScreen() {
  const colors = useColors();
  const { t } = useT();
  const plan = usePlan();
  // Il paywall e' nello stack ROOT, quindi FUORI dal gate di (app): senza
  // questa guardia `memika://paywall` (schema in app.json) apre le schede in
  // una sessione senza login. La' `usePlan()` direbbe "free" e in una build
  // con le chiavi RevenueCat i bottoni sarebbero VIVI — l'SDK non ha bisogno
  // della sessione Supabase — cosi' l'acquisto finirebbe sull'app-user-id
  // anonimo, `refreshPlan()` non avrebbe nessuno da sincronizzare e il toast
  // direbbe comunque "Ora sei Plus". Stessa coppia di app/add.tsx:188-189 e
  // app/memory/[id].tsx:202-203.
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const showToast = useUIStore((s) => s.showToast);
  const [packages, setPackages] = useState<PlanPackage[] | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!purchasesAvailable) {
      setPackages([]);
      return;
    }
    let cancelled = false;
    loadPlanPackages()
      .then((pkgs) => {
        if (cancelled) return;
        setPackages(pkgs);
        // ANNUALE preselezionato quando c'e' (Angelo, 7/9/2026): e' il
        // pacchetto che conviene, e il risparmio si legge subito sulla
        // scheda invece di restare dietro un tocco.
        setPeriod(pkgs.some((p) => p.period === "yearly") ? "yearly" : "monthly");
      })
      .catch((err) => {
        reportError("paywall/offerings", err);
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Il selettore esiste solo se ALMENO UN piano ha davvero due pacchetti
  // fra cui scegliere (hasPeriodChoice). Con i soli mensili, o con Plus
  // mensile e Pro annuale, la schermata e' quella di prima: NESSUN segmento
  // spento o inerte, niente funzionalita' segnaposto (Apple 2.1).
  const showSelector = packages ? hasPeriodChoice(packages) : false;

  // Il pacchetto di una scheda: quello del periodo selezionato, altrimenti
  // l'altro periodo dello stesso piano. Prezzo mostrato e pacchetto comprato
  // escono da QUESTA funzione e da nessun'altra: si compra cio' di cui si e'
  // letto il prezzo, altrimenti il piede legale ("si rinnova al prezzo
  // indicato", Apple 3.1.2) parlerebbe di un rinnovo diverso da quello
  // mostrato.
  const packageFor = (target: Plan): PlanPackage | null =>
    packages ? pickPlanPackage(packages, target, period) : null;

  // Le righe di prezzo seguono il PERIODO DEL PACCHETTO scelto, non il
  // selettore: se un piano ha solo il mensile, la sua scheda dice "al mese"
  // anche con "Annuale" acceso, perche' e' quello che si comprerebbe.
  const pricingFor = (target: Plan): Pricing => {
    const chosen = packageFor(target);
    if (!chosen) return { priceLine: null, perMonth: null, savings: null };
    if (chosen.period === "monthly") {
      return {
        priceLine: t("paywall.monthlyPrice", { price: chosen.priceString }),
        perMonth: null,
        savings: null,
      };
    }
    const monthly = packages?.find((p) => p.plan === target && p.period === "monthly");
    return {
      priceLine: t("paywall.yearlyPrice", { price: chosen.priceString }),
      perMonth: chosen.pricePerMonthString
        ? t("paywall.yearlyPerMonth", { price: chosen.pricePerMonthString })
        : null,
      savings: yearlySavingsPercent(monthly, chosen),
    };
  };

  const buy = async (target: Plan) => {
    // Lo stesso packageFor delle schede: quello che si compra e' quello di
    // cui si e' letto il prezzo.
    const pkg = packageFor(target);
    if (!pkg || busy) return;
    setBusy(true);
    try {
      const outcome = await purchasePlan(pkg, plan);
      // L'entitlement locale e' solo la via rapida: la verita' la riscrive
      // la edge function dopo aver interrogato RevenueCat. Se quella lettura
      // NON riesce, lo store e' rimasto a "free" e ogni gate dell'app si
      // comporta di conseguenza: il toast lo dice, invece di annunciare un
      // piano che nessuno sta applicando. Si risolve da solo al prossimo
      // avvio (startPlanSync) o con "Ripristina acquisti".
      const synced = await refreshPlan();
      if (outcome.status === "purchased") {
        showToast(
          synced
            ? t("paywall.purchased", { plan: t(PLAN_NAME_KEY[outcome.plan]) })
            : t("paywall.purchasedSyncing"),
        );
      }
    } catch (err) {
      const outcome = purchaseOutcomeFromError(err);
      if (outcome?.status === "cancelled") return; // l'utente ha detto no: nessun rumore
      if (outcome?.status === "pending") {
        showToast(t("paywall.purchasePending"));
        return;
      }
      reportError("paywall/purchase", err, { plan: target, period: pkg.period });
      showToast(t("paywall.purchaseFailed"));
    } finally {
      setBusy(false);
    }
  };

  // Un bottone solo verso l'ALTO (Angelo, 7/9/2026): niente CTA sul piano
  // attuale ne' su quelli sotto. Un Pro che vedesse "Passa a Plus" acceso
  // comprerebbe un secondo abbonamento, non un piano in meno: il
  // declassamento si fa dalle impostazioni dello store, non da qui.
  const ctaFor = (target: Plan): CardCta | null => {
    if (PLANS.indexOf(target) <= PLANS.indexOf(plan)) return null;
    return {
      label: t("paywall.chooseCta", { plan: t(PLAN_NAME_KEY[target]) }),
      disabled: busy || !packageFor(target),
      onPress: () => void buy(target),
    };
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const restored = await restorePlan();
      const synced = await refreshPlan();
      showToast(
        restored === "free"
          ? // Niente da ripristinare: la sincronizzazione col server non
            // cambierebbe nulla, quindi il suo esito qui non conta.
            t("paywall.restoreNone")
          : synced
            ? t("paywall.restored", { plan: t(PLAN_NAME_KEY[restored]) })
            : t("paywall.restoredSyncing"),
      );
    } catch (err) {
      reportError("paywall/restore", err);
      showToast(t("paywall.restoreFailed"));
    } finally {
      setBusy(false);
    }
  };

  const openExternal = (url: string) => {
    Linking.openURL(url).catch((err) => {
      reportError("paywall/open-url", err, { url });
      showToast(t("settings.openPageError"));
    });
  };

  const notice = isDemoMode
    ? t("paywall.demoNotice")
    : !purchasesAvailable
      ? t("paywall.unavailable")
      : packages === null
        ? t("paywall.loadingPrices")
        : packages.length === 0
          ? t("paywall.noPrices")
          : null;

  // Dopo gli hook: il ramo condizionale non deve mai cambiare l'ordine di
  // useEffect/useState sopra.
  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar title={t("paywall.title")} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text
          style={{
            paddingHorizontal: 22,
            paddingTop: 8,
            paddingBottom: 18,
            fontFamily: FONT.regular,
            fontSize: 14,
            lineHeight: 20,
            color: colors.midGrey,
          }}
        >
          {t("paywall.subtitle")}
        </Text>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {showSelector ? <PeriodToggle value={period} onChange={setPeriod} /> : null}
          <PlanCard
            name={t("plan.free")}
            priceLine={null}
            features={[
              t("paywall.freeMemories"),
              t("paywall.freeFolders"),
              t("paywall.freeSections"),
            ]}
            current={plan === "free"}
            cta={null}
          />
          <PlanCard
            name={t("plan.plus")}
            {...pricingFor("plus")}
            features={[
              t("paywall.plusMemories"),
              t("paywall.plusFolders"),
              t("paywall.plusSections"),
              t("paywall.plusPhotos"),
            ]}
            current={plan === "plus"}
            cta={ctaFor("plus")}
          />
          <PlanCard
            name={t("plan.pro")}
            {...pricingFor("pro")}
            features={[
              t("paywall.proMemories"),
              t("paywall.proFolders"),
              t("paywall.proSections"),
              t("paywall.proPhotos"),
            ]}
            current={plan === "pro"}
            cta={ctaFor("pro")}
          />
        </View>

        {notice ? (
          <Text
            style={{
              paddingHorizontal: 22,
              paddingTop: 16,
              textAlign: "center",
              fontFamily: FONT.medium,
              fontSize: 12.5,
              lineHeight: 18,
              color: colors.midGrey,
            }}
          >
            {notice}
          </Text>
        ) : null}

        <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
          <GhostButton
            variant="link"
            label={t("paywall.restore")}
            onPress={() => void restore()}
            disabled={busy || !purchasesAvailable}
          />
        </View>

        <Text
          style={{
            paddingHorizontal: 22,
            paddingTop: 18,
            fontFamily: FONT.regular,
            fontSize: 11.5,
            lineHeight: 17,
            color: colors.midGrey,
          }}
        >
          {t("paywall.legal")}
        </Text>
        <View style={{ flexDirection: "row", gap: 18, paddingHorizontal: 22, paddingTop: 10 }}>
          <Text
            accessibilityRole="link"
            onPress={() => openExternal(TERMS_URL)}
            style={{ fontFamily: FONT.medium, fontSize: 12, color: colors.navy }}
          >
            {t("settings.termsOfService")}
          </Text>
          <Text
            accessibilityRole="link"
            onPress={() => openExternal(PRIVACY_URL)}
            style={{ fontFamily: FONT.medium, fontSize: 12, color: colors.navy }}
          >
            {t("settings.privacyPolicy")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Le righe di prezzo di una scheda, tutte derivate dal pacchetto scelto. */
type Pricing = {
  /** "X al mese" o "X all'anno", secondo il periodo del PACCHETTO scelto. */
  priceLine: string | null;
  /** Solo per l'annuale: "pari a X al mese", formattato dallo store. */
  perMonth: string | null;
  /** Solo per l'annuale: il risparmio rispetto a dodici mensili, in percento. */
  savings: number | null;
};

type CardCta = { label: string; disabled: boolean; onPress: () => void };

/**
 * Due segmenti in una pillola: Mensile / Annuale. Stesso linguaggio dei
 * chip di FilterChip e del ThemePicker delle Impostazioni (accento pieno
 * sull'attivo, testo navy sull'inattivo), ma dentro un contenitore unico,
 * perche' qui la scelta e' esclusiva e vale per tutte le schede insieme.
 */
function PeriodToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}) {
  const colors = useColors();
  const { t } = useT();
  const options: ReadonlyArray<{ value: BillingPeriod; label: string }> = [
    { value: "monthly", label: t("paywall.periodMonthly") },
    { value: "yearly", label: t("paywall.periodYearly") },
  ];
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t("paywall.periodA11y")}
      style={{
        flexDirection: "row",
        padding: 3,
        borderRadius: radii.pill,
        backgroundColor: colors.hairline,
      }}
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Tappable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            pressedOpacity={0.8}
            containerStyle={{ flex: 1 }}
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 9,
              paddingHorizontal: 12,
              borderRadius: radii.pill,
              backgroundColor: on ? colors.accent : "transparent",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: FONT.semibold,
                fontSize: 13.5,
                color: on ? colors.onAccent : colors.navy,
                letterSpacing: -0.07,
              }}
            >
              {o.label}
            </Text>
          </Tappable>
        );
      })}
    </View>
  );
}

function PlanCard({
  name,
  priceLine,
  perMonth = null,
  savings = null,
  features,
  current,
  cta,
}: {
  name: string;
  priceLine: string | null;
  perMonth?: string | null;
  savings?: number | null;
  features: string[];
  current: boolean;
  cta: CardCta | null;
}) {
  const colors = useColors();
  const { t } = useT();
  return (
    <View
      style={{
        borderRadius: radii.card,
        backgroundColor: colors.surface,
        borderWidth: current ? 1.5 : 1,
        borderColor: current ? colors.navy : colors.hairline,
        padding: 18,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: FONT.bold, fontSize: 19, color: colors.navy }}>{name}</Text>
        {current ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radii.pill,
              backgroundColor: colors.tagProBg,
            }}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 11, color: colors.tagProText }}>
              {t("paywall.currentBadge")}
            </Text>
          </View>
        ) : null}
      </View>
      {priceLine ? (
        <View style={{ gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <Text style={{ fontFamily: FONT.semibold, fontSize: 14.5, color: colors.navy }}>
              {priceLine}
            </Text>
            {savings !== null ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.pill,
                  backgroundColor: colors.tagUserBg,
                }}
              >
                <Text style={{ fontFamily: FONT.semibold, fontSize: 11, color: colors.navy }}>
                  {t("paywall.yearlySave", { percent: savings })}
                </Text>
              </View>
            ) : null}
          </View>
          {perMonth ? (
            <Text style={{ fontFamily: FONT.regular, fontSize: 12.5, color: colors.midGrey }}>
              {perMonth}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={{ gap: 7 }}>
        {features.map((f) => (
          <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Check size={15} color={colors.navy} strokeWidth={2.2} />
            <Text style={{ fontFamily: FONT.regular, fontSize: 13.5, color: colors.midGrey }}>
              {f}
            </Text>
          </View>
        ))}
      </View>
      {cta ? (
        <View style={{ marginTop: 4 }}>
          <PrimaryButton label={cta.label} onPress={cta.onPress} disabled={cta.disabled} />
        </View>
      ) : null}
    </View>
  );
}
