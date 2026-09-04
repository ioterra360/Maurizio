import { useEffect, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { Redirect } from "expo-router";

import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { useAuthStore } from "@/lib/auth-store";
import { useT } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { reportError } from "@/lib/report-error";
import { isDemoMode } from "@/lib/supabase";
import { PRIVACY_URL, TERMS_URL } from "@/lib/constants";
import { type Plan } from "@/lib/plan";
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
 * Il paywall: tre schede, i prezzi veri di RevenueCat, un solo bottone per
 * piano.
 *
 * Vive nello stack ROOT come /add, /trash e /folder-settings: ci si arriva
 * sia da Impostazioni e da /folder/[id] (dentro i tab) sia da /add,
 * /choose-topic e /folder-settings (fuori dai tab), e una rotta di (app)
 * spinta da una schermata root creerebbe una SECONDA istanza del navigatore
 * a tab (choose-topic.tsx:52-60). Di conseguenza qui la tab bar non c'e' e
 * il piede legale — obbligatorio su una schermata di abbonamento, Apple
 * 3.1.2 — non rischia di finirci sotto.
 *
 * In questo ciclo si vende solo l'abbonamento MENSILE: un bottone per
 * scheda, nessun selettore di periodicita' (Task 10, offerta `default`).
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!purchasesAvailable) {
      setPackages([]);
      return;
    }
    let cancelled = false;
    loadPlanPackages()
      .then((pkgs) => {
        if (!cancelled) setPackages(pkgs);
      })
      .catch((err) => {
        reportError("paywall/offerings", err);
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // L'offerta `default` di questo ciclo porta solo i due pacchetti mensili
  // (checklist, Task 10). Il ramo annuale resta come rete di sicurezza: se
  // un giorno l'offerta contenesse SOLO un annuale, la scheda mostrerebbe
  // il suo prezzo e `buy` comprerebbe quello, invece di restare muta.
  const priceFor = (target: Plan): string | null => {
    if (!packages) return null;
    const monthly = packages.find((p) => p.plan === target && p.period === "monthly");
    if (monthly) return t("paywall.monthlyPrice", { price: monthly.priceString });
    const yearly = packages.find((p) => p.plan === target && p.period === "yearly");
    if (yearly) return t("paywall.yearlyPrice", { price: yearly.priceString });
    return null;
  };

  const buy = async (target: Plan) => {
    // Stesso ordine di priceFor: quello che si compra e' quello di cui si
    // e' letto il prezzo, altrimenti il piede legale parlerebbe di un
    // rinnovo diverso da quello mostrato.
    const pkg =
      packages?.find((p) => p.plan === target && p.period === "monthly") ??
      packages?.find((p) => p.plan === target);
    if (!pkg || busy) return;
    setBusy(true);
    try {
      const outcome = await purchasePlan(pkg);
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
      reportError("paywall/purchase", err, { plan: target });
      showToast(t("paywall.purchaseFailed"));
    } finally {
      setBusy(false);
    }
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
          <PlanCard
            name={t("plan.free")}
            price={null}
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
            price={priceFor("plus")}
            features={[
              t("paywall.plusMemories"),
              t("paywall.plusFolders"),
              t("paywall.plusSections"),
              t("paywall.plusPhotos"),
            ]}
            current={plan === "plus"}
            cta={
              plan === "plus"
                ? null
                : {
                    label: t("paywall.chooseCta", { plan: t("plan.plus") }),
                    disabled: busy || !packages?.some((p) => p.plan === "plus"),
                    onPress: () => void buy("plus"),
                  }
            }
          />
          <PlanCard
            name={t("plan.pro")}
            price={priceFor("pro")}
            features={[
              t("paywall.proMemories"),
              t("paywall.proFolders"),
              t("paywall.proSections"),
              t("paywall.proPhotos"),
            ]}
            current={plan === "pro"}
            cta={
              plan === "pro"
                ? null
                : {
                    label: t("paywall.chooseCta", { plan: t("plan.pro") }),
                    disabled: busy || !packages?.some((p) => p.plan === "pro"),
                    onPress: () => void buy("pro"),
                  }
            }
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

function PlanCard({
  name,
  price,
  features,
  current,
  cta,
}: {
  name: string;
  price: string | null;
  features: string[];
  current: boolean;
  cta: { label: string; disabled: boolean; onPress: () => void } | null;
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
              borderRadius: 999,
              backgroundColor: colors.tagProBg,
            }}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 11, color: colors.tagProText }}>
              {t("paywall.currentBadge")}
            </Text>
          </View>
        ) : null}
      </View>
      {price ? (
        <Text style={{ fontFamily: FONT.semibold, fontSize: 14.5, color: colors.navy }}>
          {price}
        </Text>
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
