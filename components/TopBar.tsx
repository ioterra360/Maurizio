import { Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { Tappable } from "@/components/Tappable";
import { FONT, colors } from "@/theme/tokens";
import { safeBack } from "@/lib/safe-back";
import { useT } from "@/lib/i18n";

type Props = {
  title?: string;
  onBack?: () => void;
  /** Optional right-aligned element (text button, icon, etc.). */
  rightSlot?: React.ReactNode;
};

/**
 * Modal-style top bar: back chevron on the left, optional centered title,
 * optional right slot. Used on Add to memory and Folder detail.
 *
 * Default back behavior goes through safeBack so the keyboard is dismissed
 * before navigation — see lib/safe-back.ts for the Android race this fixes.
 */
export function TopBar({ title, onBack, rightSlot }: Props) {
  const { t } = useT();
  const handleBack = () => {
    if (onBack) onBack();
    else safeBack();
  };
  return (
    <View
      className="flex-row items-center justify-between"
      style={{
        paddingLeft: 14,
        paddingRight: 18,
        paddingVertical: 8,
        minHeight: 48,
        backgroundColor: "rgba(250,248,244,0.94)",
        borderBottomColor: "transparent",
        borderBottomWidth: 1,
      }}
    >
      <Tappable
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        pressedOpacity={0.6}
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronLeft size={22} color={colors.navy} strokeWidth={2} />
      </Tappable>

      {/* Titolo ancorato al CENTRO DELLO SCHERMO, non al centro dello
          spazio residuo: con flex:1 la larghezza diversa dei lati (freccia
          40px vs "Salva") lo spostava — sotto, il termine è centrato sullo
          schermo e i due sembravano disallineati (Angelo, 2026-08-31).
          left/right 64 = spazio del lato più largo, così il titolo non
          finisce mai sotto i tasti. */}
      {title ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 64,
            right: 64,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            className="text-navy"
            style={{
              fontFamily: FONT.semibold,
              fontSize: 16,
              letterSpacing: -0.16,
              textAlign: "center",
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />

      <View style={{ minWidth: 40, flexShrink: 0, alignItems: "flex-end" }}>{rightSlot ?? null}</View>
    </View>
  );
}
