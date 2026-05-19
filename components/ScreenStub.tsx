import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

/**
 * Editorial header pattern used across the four primary user screens
 * during Phase 1. Mirrors the mockup: warm canvas, large navy h1 with
 * `-0.03em` tracking, optional mid-grey sub-line directly beneath.
 *
 * Phase 2 replaces each consumer with its real screen content.
 */
export function ScreenStub({ title, subtitle, children }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <View className="px-6 pt-5 pb-6">
        <Text
          className="text-h1 text-navy"
          style={{ fontFamily: "Inter_700Bold" }}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="mt-1.5 text-body-lg text-mid-grey"
            style={{ fontFamily: "Inter_400Regular" }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </SafeAreaView>
  );
}
