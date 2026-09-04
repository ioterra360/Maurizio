/**
 * Quando una presentazione nativa deve ASPETTARE la chiusura di un `Modal`.
 *
 * Un `Modal` di React Native non si chiude in modo sincrono: `visible={false}`
 * avvia un'animazione di ~300 ms e lo stato non e' nemmeno ancora committato
 * nel tick in cui si scrive. Su iOS quel Modal e' un
 * `RCTModalHostViewController` PRESENTATO sul view controller della schermata
 * che lo monta, quindi finche' l'animazione non finisce quel view controller
 * ha gia' un `presentedViewController`: qualunque altra presentazione nativa
 * chiesta nello stesso momento — il picker delle foto, oppure una rotta
 * `presentation: "modal"` spinta dal router (app/_layout.tsx) — viene
 * RIFIUTATA da UIKit e non compare mai. L'utente vede solo il foglio che
 * scivola via, e lo stato del router dice che c'e' una schermata che non c'e'.
 *
 * Su Android il Modal e' un `Dialog`: nessun conflitto di presentazione, si
 * naviga subito. `Modal.onDismiss` la' non viene nemmeno chiamato (e'
 * iOS-only, react-native/Libraries/Modal/Modal.d.ts), quindi aspettarlo
 * significherebbe non navigare mai.
 *
 * Chi chiama tiene l'intenzione in uno stato e la esegue da `Modal.onDismiss`
 * (prop `onDismissed` di MascotDialog / BottomSheetShell) quando questa
 * funzione dice `true`.
 *
 * L'argomento esiste per i test: in produzione non lo passa nessuno.
 */
import { Platform } from "react-native";

export function deferUntilModalDismissed(os: string = Platform.OS): boolean {
  return os === "ios";
}
