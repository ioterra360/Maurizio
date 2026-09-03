/**
 * revenuecat-sync — l'unica cosa autorizzata a scrivere profiles.plan.
 *
 * Due ingressi, una sola strada:
 *   a) l'app, con il JWT dell'utente: app_user_id = auth.uid();
 *   b) il webhook di RevenueCat, con l'header Authorization concordato:
 *      app_user_id = event.app_user_id.
 * In entrambi i casi il piano NON viene dal corpo della richiesta: si
 * ri-legge da GET /v1/subscribers/{app_user_id} con la chiave segreta. Il
 * client non e' una fonte attendibile per un permesso, e il payload di un
 * webhook nemmeno (RevenueCat stessa consiglia di richiamare la REST dopo
 * ogni evento).
 *
 * verify_jwt = false in config.toml perche' il webhook non ha un JWT; la
 * verifica del JWT la fa questa funzione con auth.getUser(token). Nessuna
 * chiave nel repo: REVENUECAT_SECRET_KEY e REVENUECAT_WEBHOOK_SECRET sono
 * secrets del progetto, SUPABASE_SERVICE_ROLE_KEY la inietta la piattaforma.
 *
 * QUESTO FILE NON PASSA DA `npm run lint`: e' Deno, non l'app. Gli
 * specificatori `npm:` e il globale `Deno` non esistono nel programma
 * TypeScript dell'app, quindi supabase/functions e' escluso in
 * tsconfig.json. Chi lo controlla e' `deno check` / il deploy della
 * funzione.
 */
import { createClient } from "npm:@supabase/supabase-js@2.106.2";

type Plan = "free" | "pro" | "premium";

const RC_SUBSCRIBERS = "https://api.revenuecat.com/v1/subscribers/";
const ENTITLEMENT_PRO = "pro";
const ENTITLEMENT_PREMIUM = "premium";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RcEntitlement = {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
};

type RcSubscriberResponse = {
  request_date: string;
  subscriber: { entitlements?: Record<string, RcEntitlement | undefined> };
};

// NOTA (fix round 1 su Task 1, 2026-09-03): questa funzione e' cambiata in
// lib/plan.ts — la grazia PROLUNGA l'accesso, non lo sostituisce. Una
// grace_period_expires_date vecchia lasciata da RevenueCat accanto a una
// expires_date futura declassava a free un abbonato che paga. Il gemello
// Deno DEVE essere questo, non piu' quello con `??`.
/** La scadenza dell'ACCESSO: la PIU' TARDA fra scadenza e grazia. */
function rcDeadline(ent: RcEntitlement): string | null {
  // expires_date null = accesso a vita: nessuna grazia puo' accorciarlo.
  if (ent.expires_date == null) return null;
  const grace = ent.grace_period_expires_date;
  if (!grace) return ent.expires_date;
  const graceTs = Date.parse(grace);
  if (Number.isNaN(graceTs)) return ent.expires_date;
  const expiresTs = Date.parse(ent.expires_date);
  if (Number.isNaN(expiresTs)) return grace;
  return graceTs > expiresTs ? grace : ent.expires_date;
}

function rcActive(ent: RcEntitlement, at: number): boolean {
  const deadline = rcDeadline(ent);
  if (deadline === null) return true;
  const ts = Date.parse(deadline);
  return Number.isNaN(ts) ? false : ts > at;
}

/**
 * gemello di lib/plan.ts planFromRcEntitlements — Deno non puo' importare
 * da lib/, quindi la funzione e' ricopiata. Se cambi una delle due, cambia
 * l'altra e il test lib/plan.test.ts.
 *
 * planUntil e' la scadenza dell'ACCESSO, non quella di fatturazione: durante
 * il periodo di grazia vale la grace_period_expires_date, altrimenti
 * current_plan() degraderebbe a free un abbonato in billing-retry nel
 * momento esatto in cui la grazia dovrebbe proteggerlo.
 */
function planFromRcEntitlements(
  entitlements: Record<string, RcEntitlement | undefined>,
  requestDate: string,
): { plan: Plan; planUntil: string | null } {
  const parsed = Date.parse(requestDate);
  const at = Number.isNaN(parsed) ? Date.now() : parsed;
  const premium = entitlements[ENTITLEMENT_PREMIUM];
  if (premium && rcActive(premium, at)) {
    return { plan: "premium", planUntil: rcDeadline(premium) };
  }
  const pro = entitlements[ENTITLEMENT_PRO];
  if (pro && rcActive(pro, at)) {
    return { plan: "pro", planUntil: rcDeadline(pro) };
  }
  return { plan: "free", planUntil: null };
}

/** Confronto a tempo costante: l'header del webhook e' un segreto. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const rcKey = Deno.env.get("REVENUECAT_SECRET_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!rcKey || !supabaseUrl || !serviceKey) {
    console.error("revenuecat-sync: secrets mancanti");
    return json({ error: "not_configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";
  const isWebhook = webhookSecret.length > 0 && safeEqual(authHeader, webhookSecret);

  let appUserId: string;
  if (isWebhook) {
    let payload: { event?: { type?: string; app_user_id?: string } };
    try {
      payload = (await req.json()) as typeof payload;
    } catch {
      return json({ error: "bad_json" }, 400);
    }
    const event = payload.event;
    // 200 e non un errore: RevenueCat riprova cinque volte su tutto cio'
    // che non e' 2xx, e questi tre casi non migliorano riprovando.
    if (!event?.app_user_id) return json({ ok: true, ignored: "no_app_user_id" }, 200);
    if (event.type === "TEST") return json({ ok: true, ignored: "test_event" }, 200);
    if (!UUID_RE.test(event.app_user_id)) {
      // $RCAnonymousID:… — un acquisto non ancora legato a un account.
      return json({ ok: true, ignored: "anonymous_app_user_id" }, 200);
    }
    appUserId = event.app_user_id;
  } else {
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return json({ error: "unauthorized" }, 401);
    appUserId = data.user.id;
  }

  // ATTENZIONE: questa GET CREA il subscriber se non esiste ("Get or Create
  // Customer"). Va chiamata solo con un id verificato — mai con uno preso
  // dal corpo di una richiesta non autenticata.
  const rcRes = await fetch(`${RC_SUBSCRIBERS}${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${rcKey}`, "Content-Type": "application/json" },
  });
  if (!rcRes.ok) {
    console.error(`revenuecat-sync: RevenueCat ha risposto ${rcRes.status}`);
    // 502 anche per il webhook: qui riprovare ha senso.
    return json({ error: "revenuecat_unavailable" }, 502);
  }
  const body = (await rcRes.json()) as RcSubscriberResponse;
  const { plan, planUntil } = planFromRcEntitlements(
    body.subscriber?.entitlements ?? {},
    body.request_date,
  );

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ plan, plan_until: planUntil, rc_app_user_id: appUserId })
    .eq("id", appUserId)
    .select("id");
  if (updateError) {
    console.error("revenuecat-sync: scrittura fallita", updateError.message);
    return json({ error: "write_failed" }, 500);
  }
  if (!updated || updated.length === 0) {
    // Nessun profilo con quell'id: account cancellato, o un app_user_id che
    // non e' mai stato nostro. Riprovare non lo fara' comparire.
    return isWebhook
      ? json({ ok: true, ignored: "no_profile" }, 200)
      : json({ error: "no_profile" }, 404);
  }

  return json({ plan, planUntil }, 200);
});
