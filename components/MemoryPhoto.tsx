import { useEffect, useState } from "react";
import { Image, View, type ImageErrorEvent, type StyleProp, type ViewStyle } from "react-native";

import { useT } from "@/lib/i18n";
import { getPhotoUrl } from "@/lib/photos";
import { reportError } from "@/lib/report-error";
import { useColors } from "@/theme/tokens";

type Props = {
  /** Chiave nel bucket (memories.photo_path). Risolta in URL firmato al render. */
  path?: string | null;
  /** file:// locale — l'anteprima in Add prima del caricamento. Vince su path. */
  localUri?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * La foto sul RETRO di un ricordo: larghezza piena, 4:3, angoli 12, cover,
 * al massimo 240 di altezza. Chi la monta decide QUANDO: nei ripassi solo
 * dentro il pannello rivelato, mai sul fronte (memoria visiva = àncora che
 * arriva DOPO il tentativo di ricordo). Senza URL — demo, errore di rete,
 * bucket irraggiungibile — non renderizza nulla: niente riquadri vuoti.
 * Vale anche a valle: se l'URL c'è ma l'immagine non si carica (firma
 * scaduta, oggetto rimosso, offline) `onError` riporta a "nessun URL", così
 * il riquadro grigio del contenitore non resta mai da solo sullo schermo.
 */
export function MemoryPhoto({ path, localUri, style }: Props) {
  const colors = useColors();
  const { t } = useT();
  const [uri, setUri] = useState<string | null>(localUri ?? null);

  useEffect(() => {
    if (localUri) {
      setUri(localUri);
      return;
    }
    if (!path) {
      setUri(null);
      return;
    }
    let cancelled = false;
    getPhotoUrl(path)
      .then((u) => {
        if (!cancelled) setUri(u);
      })
      .catch((e) => {
        reportError("photo/signed-url", e);
        if (!cancelled) setUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path, localUri]);

  if (!uri) return null;
  return (
    <View
      style={[
        {
          width: "100%",
          aspectRatio: 4 / 3,
          maxHeight: 240,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: colors.divider,
        },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
        // `alt` (e non `accessibilityLabel`) perché RN imposta accessible=true
        // solo quando `alt` è definito: con la sola label l'immagine non è un
        // elemento accessibile su iOS e VoiceOver non annuncia nulla.
        alt={t("memory.photoA11y")}
        onError={(e: ImageErrorEvent) => {
          // `error` è tipato `any` da RN: lo confino subito in `unknown`.
          const cause: unknown = e.nativeEvent?.error;
          reportError("photo/image-load", cause ?? e);
          setUri(null);
        }}
      />
    </View>
  );
}
