import { Keyboard, Platform } from "react-native";
import { router, type Href } from "expo-router";

/**
 * Close a screen without leaving an open keyboard latched to a stale view.
 *
 * Why: on Android, calling `router.back()` while the keyboard is open from a
 * modal screen (e.g. Add to memory) can leave the soft keyboard attached to
 * the unmounted TextInput, freezing input on the destination screen. The fix
 * is to dismiss the keyboard first, yield a frame so RN reconciles the
 * keyboard teardown, then navigate. On iOS this is harmless extra work.
 *
 * If the stack has nothing to pop, we replace into the fallback href instead
 * so we never strand the user on a dead screen.
 */
export function safeBack(fallback: Href = "/(app)/today") {
  Keyboard.dismiss();
  const go = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };
  if (Platform.OS === "android") {
    // One frame is enough for the IME teardown listener to fire before nav.
    setTimeout(go, 0);
  } else {
    go();
  }
}
