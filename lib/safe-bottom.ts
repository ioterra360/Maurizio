/**
 * Spazio in fondo a una schermata o a un foglio, sopra la barra di sistema.
 *
 * Su Android con i tre tasti di navigazione l'inset inferiore e' ~48dp e
 * l'app disegna SOTTO la barra (`edgeToEdgeEnabled` in app.json): un
 * `paddingBottom` fisso di 32 lascia l'ultimo bottone sotto i tasti, come
 * "Elimina ricordo" (Angelo, 7/9/2026). Su iPhone l'inset e' l'indicatore
 * Home (34pt). Regola unica per tutti: l'inset piu' un respiro, e mai meno
 * del minimo che il layout aveva gia' (che resta il valore senza barra).
 */
export function safeBottom(inset: number, min: number, gap = 12): number {
  const safe = Number.isFinite(inset) && inset > 0 ? inset : 0;
  return Math.max(safe + gap, min);
}
