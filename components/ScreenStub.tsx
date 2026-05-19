import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  title: string;
  greeting?: string;
  note: string;
  children?: React.ReactNode;
};

/**
 * Shared shell for the four primary user screens during Phase 1.
 * Mimics the editorial header from Memora App.html (warm canvas, big serif-feeling
 * title, mid-grey sub-line) while the real content gets built in Phase 2.
 */
export function ScreenStub({ title, greeting, note, children }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <View className="px-6 pt-4 pb-6">
        {greeting ? (
          <Text
            className="mb-2 text-body text-mid-grey"
            style={{ fontFamily: "Inter_500Medium" }}
          >
            {greeting}
          </Text>
        ) : null}
        <Text
          className="text-h1 text-navy"
          style={{ fontFamily: "Inter_700Bold", lineHeight: 33 }}
        >
          {title}
        </Text>
      </View>
      <View className="mx-4 rounded-card bg-surface p-5" style={{ borderWidth: 1, borderColor: "rgba(26,44,79,0.08)" }}>
        <Text
          className="text-body text-mid-grey"
          style={{ fontFamily: "Inter_400Regular", lineHeight: 20 }}
        >
          {note}
        </Text>
      </View>
      {children}
    </SafeAreaView>
  );
}
