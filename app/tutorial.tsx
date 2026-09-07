import { useEffect, useState } from "react";
import { Image, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { Mascot } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Tappable } from "@/components/Tappable";
import { useAuthStore } from "@/lib/auth-store";
import { useLocaleStore, useT, type TKey } from "@/lib/i18n";
import { shotSource } from "@/lib/tutorial-shot-sources";
import { SHOT_ASPECT, type TutorialShot } from "@/lib/tutorial-shots";
import {
  TUTORIAL_STEPS,
  pageIndex,
  type TutorialMascot,
  type TutorialTint,
} from "@/lib/tutorial-steps";
import { useTutorialStore } from "@/lib/tutorial-store";
import { FONT, useThemeStore, useThemeTokens, type ThemeTokens } from "@/theme/tokens";

/**
 * Il tutorial di benvenuto: la mascotte si presenta, poi sei schermate VERE
 * dell'app in una cornice di telefono, due frasi ciascuna, saltabile in un
 * tocco (Angelo, 7/9/2026: "deve spiegare come funziona l'app, con le
 * immagini reali"). Gli screenshot sono per lingua e per tema
 * (lib/tutorial-shots.ts, scripts/tutorial-shots/).
 *
 * QUANDO COMPARE. Dopo il login, una volta per telefono (lib/tutorial-store):
 *   - dopo la registrazione, spinto da signup.tsx al posto del vecchio
 *     carosello di (auth); alla fine si va a /choose-topic, perche' l'app
 *     non funziona senza una cartella;
 *   - per chi entra su un telefono nuovo, spinto da app/(app)/_layout.tsx
 *     sopra Oggi alla prima apertura; alla fine si torna indietro;
 *   - da Impostazioni > Rivedi il tutorial (`?replay=1`), stessa uscita.
 * "Visto" si segna al MOUNT (se il tutorial viene mostrato davvero), non
 * alla fine: anche chi torna indietro col gesto di sistema l'ha visto.
 *
 * DOVE VIVE. Nello stack ROOT come /choose-topic (docs/ROUTING.md): il gate
 * di (auth) rimbalza a Oggi qualunque utente loggato, e una rotta di (app)
 * spinta da fuori monterebbe un secondo navigatore a tab.
 *
 * COME SI MUOVE. Tutto e' legato allo scorrimento (reanimated, gia' nel
 * binario: nessuna dipendenza nuova, esce via OTA). Il fondo si dissolve
 * da una tinta all'altra, la mascotte entra a molla e poi respira, le
 * cornici scalano, il testo sale in dissolvenza, i pallini si allungano.
 * Tre anelli si allargano dietro la mascotte del primo passo: e' l'unica
 * eccezione al "niente decorazioni" del design system, prevista proprio
 * per l'onboarding (DESIGN-SYSTEM.md § Animation rules). Con "riduci
 * movimento" attivo restano solo le dissolvenze legate al dito.
 */

const SPRING = { damping: 14, stiffness: 120, mass: 0.9 };

type Tints = Record<TutorialTint, { page: string; ring: string }>;

/** I nomi delle tinte (lib/tutorial-steps) risolti nella palette del tema. */
function resolveTints(tokens: ThemeTokens): Tints {
  const { colors, layerTint, statusTint } = tokens;
  return {
    welcome: { page: colors.canvas, ring: colors.accent },
    focus: { page: layerTint.focus, ring: colors.focus },
    reinforcement: { page: layerTint.reinforcement, ring: colors.reinforcement },
    active: { page: statusTint.active.bg, ring: colors.active },
    scan: { page: layerTint.scan, ring: colors.scan },
  };
}

/** Quanto siamo lontani dal centro della pagina `index`: 0 a fuoco, 1 fuori. */
function distanceFrom(scrollX: number, index: number, width: number): number {
  "worklet";
  return Math.min(Math.abs(scrollX - index * width) / width, 1);
}

export default function TutorialScreen() {
  const { t } = useT();
  const tokens = useThemeTokens();
  const { colors } = tokens;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === "1";

  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const pendingOnboarding = useAuthStore((s) => s.pendingOnboarding);
  const setPendingOnboarding = useAuthStore((s) => s.setPendingOnboarding);
  const markSeen = useTutorialStore((s) => s.markSeen);

  const steps = TUTORIAL_STEPS;
  const count = steps.length;
  const tints = resolveTints(tokens);

  // Chi puo' vederlo: un utente in sessione, oppure chi arriva dalla
  // registrazione (pendingOnboarding) mentre `user` e' ancora in volo.
  // signup.tsx aspetta adoptSession() prima di navigare, ma questa guardia
  // non dipende da quell'ordine: il listener SIGNED_IN scrive `user` solo
  // dopo una query su profiles rimandata a un setTimeout (lib/auth-store.ts),
  // e un rimbalzo al login qui lascerebbe il nuovo utente fermo sulla
  // schermata di accesso, con il gate di (auth) che lo tiene dentro finche'
  // il flag resta alzato.
  const canShow = hydrated && (user !== null || pendingOnboarding);

  const [step, setStep] = useState(0);
  const scrollX = useSharedValue(0);
  const lastIndex = useSharedValue(0);
  const enter = useSharedValue(reduced ? 1 : 0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  // Visto = mostrato. Si segna subito, cosi' anche un'uscita col gesto di
  // sistema conta; il replay da Impostazioni non ha nulla da segnare.
  useEffect(() => {
    if (canShow && !isReplay) markSeen();
  }, [canShow, isReplay, markSeen]);

  useEffect(() => {
    if (!reduced) enter.value = withSpring(1, SPRING);
  }, [enter, reduced]);

  // Rotazione o split-screen: le pagine cambiano larghezza, si riallinea.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: step * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
      const next = pageIndex(e.contentOffset.x, width, count);
      if (next !== lastIndex.value) {
        lastIndex.value = next;
        runOnJS(setStep)(next);
      }
    },
  });

  const inputRange = steps.map((_, i) => i * width);
  const pageStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      scrollX.value,
      inputRange,
      steps.map((s) => tints[s.tint].page),
    ),
  }));

  const finish = () => {
    if (pendingOnboarding) {
      // Flusso di registrazione: sotto di noi non c'e' nulla (signup ha
      // fatto replace). Stessa uscita del vecchio carosello.
      setPendingOnboarding(false);
      router.replace((user ? "/choose-topic" : "/(auth)/login") as never);
      return;
    }
    // Spinto sopra Oggi o sopra Impostazioni: si torna dove si era. Un
    // replace verso (app) monterebbe un secondo navigatore a tab
    // (choose-topic.tsx, goToday).
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/today" as never);
  };

  const goNext = () => {
    if (step < count - 1) {
      scrollRef.current?.scrollTo({ x: (step + 1) * width, animated: true });
    } else {
      finish();
    }
  };

  // Dopo gli hook: il ramo condizionale non deve cambiarne l'ordine.
  if (!hydrated) return null;
  if (!canShow) return <Redirect href="/(auth)/login" />;

  // Quanto resta per l'immagine, tolti gli inset veri e il cromo fisso:
  // riga Salta (~26), pallini + bottone + padding (111), padding di pagina
  // (24), titolo (58) e corpo su quattro righe (102) = ~320 pt. Su un
  // telefono alto la cornice arriva a 480; su uno da 4,7 pollici e' una
  // miniatura da ~330 pt (e' il testo a spiegare, non l'immagine da
  // leggere) e il resto scorre, perche' ogni pagina e' uno scroll.
  const usable = height - insets.top - insets.bottom;
  const frameHeight = Math.max(250, Math.min(480, Math.round(usable - 320)));
  const heroSize = Math.min(200, Math.max(132, Math.round(height * 0.24)));

  return (
    <View style={{ flex: 1 }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0 }, pageStyle]} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View
          style={{
            paddingHorizontal: 22,
            paddingTop: 8,
            flexDirection: "row",
            justifyContent: "flex-end",
          }}
        >
          <Tappable onPress={finish} accessibilityRole="link" hitSlop={10} pressedOpacity={0.6}>
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 13,
                color: colors.midGrey,
                letterSpacing: 0.2,
              }}
            >
              {t("common.skip")}
            </Text>
          </Tappable>
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {steps.map((s, i) => (
            <Page
              key={s.key}
              index={i}
              width={width}
              scrollX={scrollX}
              enter={enter}
              reduced={reduced}
              mascot={s.mascot}
              shot={s.shot}
              heroSize={heroSize}
              frameHeight={frameHeight}
              ring={tints[s.tint].ring}
              titleKey={s.titleKey}
              bodyKey={s.bodyKey}
            />
          ))}
        </Animated.ScrollView>

        <View style={{ paddingHorizontal: 28, paddingBottom: 28, gap: 22 }}>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
            {steps.map((s, i) => (
              <Dot key={s.key} index={i} width={width} scrollX={scrollX} />
            ))}
          </View>
          <PrimaryButton
            label={step === count - 1 ? t("onboarding.startNow") : t("common.continue")}
            onPress={goNext}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

type PageProps = {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  enter: SharedValue<number>;
  reduced: boolean;
  mascot: TutorialMascot;
  shot: TutorialShot | undefined;
  heroSize: number;
  frameHeight: number;
  ring: string;
  titleKey: TKey;
  bodyKey: TKey;
};

function Page({
  index,
  width,
  scrollX,
  enter,
  reduced,
  mascot,
  shot,
  heroSize,
  frameHeight,
  ring,
  titleKey,
  bodyKey,
}: PageProps) {
  const { t } = useT();
  const { colors } = useThemeTokens();

  const textStyle = useAnimatedStyle(() => {
    const dist = distanceFrom(scrollX.value, index, width);
    return {
      opacity: (1 - dist) * enter.value,
      transform: [{ translateY: dist * 14 + (1 - enter.value) * 8 }],
    };
  });

  return (
    <View style={{ width }}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 32,
          paddingVertical: 12,
        }}
      >
        {shot ? (
          <ShotFrame
            index={index}
            width={width}
            scrollX={scrollX}
            enter={enter}
            shot={shot}
            mascot={mascot}
            height={frameHeight}
          />
        ) : (
          <Hero
            index={index}
            width={width}
            scrollX={scrollX}
            enter={enter}
            reduced={reduced}
            mascot={mascot}
            size={heroSize}
            discSize={heroSize + 44}
            ring={ring}
          />
        )}

        <Animated.View style={[{ alignItems: "center" }, textStyle]}>
          <Text
            style={{
              marginTop: shot ? 26 : 34,
              fontFamily: FONT.bold,
              fontSize: 26,
              lineHeight: 32,
              letterSpacing: -0.5,
              color: colors.navy,
              textAlign: "center",
            }}
          >
            {t(titleKey)}
          </Text>
          <Text
            style={{
              marginTop: 10,
              fontFamily: FONT.regular,
              fontSize: 15,
              lineHeight: 23,
              color: colors.midGrey,
              textAlign: "center",
              maxWidth: 320,
            }}
          >
            {t(bodyKey)}
          </Text>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

type ShotFrameProps = {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  enter: SharedValue<number>;
  shot: TutorialShot;
  mascot: TutorialMascot;
  height: number;
};

/**
 * Lo screenshot vero dell'app in una cornice di telefono, con la mascotte
 * che sbircia dall'angolo. Immagine per lingua e per tema, cosi' quello che
 * si vede nel tutorial e' quello che si vedra' un attimo dopo.
 */
function ShotFrame({ index, width, scrollX, enter, shot, mascot, height }: ShotFrameProps) {
  const { colors } = useThemeTokens();
  const scheme = useThemeStore((s) => s.scheme);
  const locale = useLocaleStore((s) => s.locale);
  const bezel = 5;
  const frameW = Math.round(height * SHOT_ASPECT);
  // In chiaro la scocca e' navy come i bottoni; in scuro navy E' il testo,
  // quindi si usa il divisore, un grigio appena piu' chiaro del fondo.
  const shell = scheme === "dark" ? colors.divider : colors.navy;

  const style = useAnimatedStyle(() => {
    const dist = distanceFrom(scrollX.value, index, width);
    const scale =
      interpolate(dist, [0, 1], [1, 0.9], Extrapolation.CLAMP) *
      interpolate(enter.value, [0, 1], [0.96, 1]);
    return {
      opacity: interpolate(dist, [0, 1], [1, 0.3], Extrapolation.CLAMP) * enter.value,
      transform: [{ translateY: dist * 10 + (1 - enter.value) * 8 }, { scale }],
    };
  });

  return (
    <Animated.View style={[{ width: frameW, height, alignItems: "center" }, style]}>
      <View
        style={{
          width: frameW,
          height,
          borderRadius: 30,
          backgroundColor: shell,
          padding: bezel,
          overflow: "hidden",
        }}
      >
        <Image
          accessibilityIgnoresInvertColors
          source={shotSource(shot, locale, scheme)}
          resizeMode="cover"
          style={{
            width: frameW - bezel * 2,
            height: height - bezel * 2,
            borderRadius: 30 - bezel,
            backgroundColor: colors.canvas,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -22,
          bottom: -14,
          width: 66,
          height: 66,
          borderRadius: 999,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.hairlineStrong,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Mascot variant={mascot} size={50} withShadow={false} />
      </View>
    </Animated.View>
  );
}

type HeroProps = {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  enter: SharedValue<number>;
  reduced: boolean;
  mascot: TutorialMascot;
  size: number;
  discSize: number;
  ring: string;
};

/** Il disco chiaro, i tre anelli che si allargano e la mascotte che respira. */
function Hero({ index, width, scrollX, enter, reduced, mascot, size, discSize, ring }: HeroProps) {
  const { colors } = useThemeTokens();
  const scheme = useThemeStore((s) => s.scheme);
  // In chiaro il disco e' bianco su pastello. In scuro `surface` e' quasi
  // uguale alle tinte di pagina: il divisore, un grigio appena piu' chiaro,
  // resta leggibile come una luna sul fondo.
  const disc = scheme === "dark" ? colors.divider : colors.surface;
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    // Respiro lento: un ciclo ogni 3,4 s (DESIGN-SYSTEM.md, onboarding mascot).
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [bob, reduced]);

  const mascotStyle = useAnimatedStyle(() => {
    const dist = distanceFrom(scrollX.value, index, width);
    const scale =
      interpolate(dist, [0, 1], [1, 0.82], Extrapolation.CLAMP) *
      interpolate(enter.value, [0, 1], [0.86, 1]);
    return {
      opacity: interpolate(dist, [0, 1], [1, 0.25], Extrapolation.CLAMP) * enter.value,
      transform: [{ translateY: bob.value * -6 + dist * 10 }, { scale }],
    };
  });

  return (
    <View
      style={{
        width: discSize,
        height: discSize,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {[0, 900, 1800].map((delay) => (
        <Ring
          key={delay}
          delay={delay}
          index={index}
          width={width}
          scrollX={scrollX}
          reduced={reduced}
          size={discSize}
          color={ring}
        />
      ))}
      <View
        style={{
          position: "absolute",
          width: discSize,
          height: discSize,
          borderRadius: 999,
          backgroundColor: disc,
        }}
      />
      <Animated.View style={mascotStyle}>
        <Mascot variant={mascot} size={size} withShadow={false} />
      </Animated.View>
    </View>
  );
}

type RingProps = {
  delay: number;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  reduced: boolean;
  size: number;
  color: string;
};

/** Un anello che nasce sul bordo del disco e svanisce allargandosi (2,6 s). */
function Ring({ delay, index, width, scrollX, reduced, size, color }: RingProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false),
    );
  }, [delay, progress, reduced]);

  const style = useAnimatedStyle(() => {
    // Gli anelli vivono solo sulla pagina a fuoco: durante lo scorrimento
    // sfumano, cosi' non sbordano nella pagina accanto.
    const dist = distanceFrom(scrollX.value, index, width);
    const focus = interpolate(dist, [0, 0.5], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: interpolate(progress.value, [0, 0.12, 1], [0, 0.32, 0], Extrapolation.CLAMP) * focus,
      transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.55]) }],
    };
  });

  if (reduced) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

type DotProps = { index: number; width: number; scrollX: SharedValue<number> };

/** Il pallino attivo si allunga a 22 px; gli altri restano a 7. */
function Dot({ index, width, scrollX }: DotProps) {
  const { colors } = useThemeTokens();
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, range, [7, 22, 7], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(scrollX.value, range, [
        colors.hairlineStrong,
        colors.accent,
        colors.hairlineStrong,
      ]),
    };
  });
  return <Animated.View style={[{ height: 7, borderRadius: 999 }, style]} />;
}
