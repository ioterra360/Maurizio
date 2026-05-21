import { Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  /** Optional mid-grey kicker above the title (e.g. greeting). */
  kicker?: string;
  title: string;
  subtitle?: string;
  /**
   * Extra right-padding to reserve for an absolutely-positioned overlay
   * (e.g. the coach mascot on Today/Knowledge/Health/Settings). Without
   * this, long Italian subtitles render under the mascot on narrow phones.
   */
  reservedRight?: number;
};

/**
 * Editorial screen header: optional kicker, big navy h1, optional sub-line.
 * Used on every primary screen for a consistent feel.
 */
export function HeaderHero({ kicker, title, subtitle, reservedRight }: Props) {
  const extraRight = reservedRight ?? 0;
  return (
    <View
      style={{
        paddingLeft: 24,
        paddingRight: 24 + extraRight,
        paddingTop: 20,
        paddingBottom: 18,
      }}
    >
      {kicker ? (
        <Text
          className="text-body text-mid-grey"
          style={{ fontFamily: FONT.medium }}
        >
          {kicker}
        </Text>
      ) : null}
      <Text
        accessibilityRole="header"
        className="text-h1 text-navy"
        style={{ fontFamily: FONT.bold, marginTop: kicker ? 2 : 0 }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 15,
            color: colors.midGrey,
            marginTop: 6,
            lineHeight: 21,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
