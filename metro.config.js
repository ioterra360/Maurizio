// Sentry's `getSentryExpoConfig` REPLACES `getDefaultConfig` (it wires the
// debug-id serializer used to match source maps). NativeWind wraps the
// result. Do NOT stack `withSentryConfig` on top of this and do NOT enable
// `annotateReactComponents` — both reproduce the RN 0.81 export crash
// "Cannot read properties of undefined (reading 'match')" during
// `expo export:embed` (getsentry/sentry-react-native#5315).
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
