import type { APIRoute } from "astro";
import { requireAdminUser, unauthorizedResponse } from "../../lib/adminAuth";
import { createContactLead, fetchContactLeads } from "../../lib/portfolio";
import { getServerSupabaseAdminClient } from "../../lib/supabase";

export const prerender = false;
const MAX_BODY_BYTES = 8 * 1024;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const BLOCK_MS = 10 * 60_000;
const requestLog = new Map<string, { hits: number[]; blockedUntil: number }>();

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAdminUser(request);
    if (!user) return unauthorizedResponse();

    const supabase = getServerSupabaseAdminClient();
    const leads = await fetchContactLeads(supabase, 50);

    return new Response(JSON.stringify({ data: leads }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 200,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? normalizeContactLeadError(error.message)
        : "No se pudieron cargar los contactos.",
      500
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!isSafeOrigin(request)) {
      return jsonError("Origen no permitido.", 403);
    }

    const ip = getClientIp(request);
    const rateLimit = consumeRateLimit(ip);
    if (!rateLimit.allowed) {
      return jsonError(
        "Demasiados intentos. Intenta nuevamente en unos minutos.",
        429
      );
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) {
      return jsonError("Solicitud demasiado grande.", 413);
    }

    const body = await request.json();
    const website = String(body?.website || "").trim();
    const submittedAt = Number(body?.submittedAt || 0);
    const tookMs = Date.now() - submittedAt;
    const name = String(body?.name || "");
    const email = String(body?.email || "");
    const project = String(body?.project || "");
    const message = String(body?.message || "");

    if (website) {
      return jsonError("No se pudo validar la solicitud.", 400);
    }

    if (!Number.isFinite(submittedAt) || tookMs < 2500 || tookMs > 30 * 60_000) {
      return jsonError("Tiempo de envio invalido.", 400);
    }

    const supabase = getServerSupabaseAdminClient();
    const lead = await createContactLead(supabase, {
      name,
      email,
      project,
      message,
    });

    return new Response(JSON.stringify({ data: lead }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 201,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? normalizeContactLeadError(error.message)
        : "No se pudo guardar la consulta.";
    const status = message.includes("invalido") ? 400 : 500;
    return jsonError(message, status);
  }
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status,
  });
}

function normalizeContactLeadError(message: string) {
  if (message.includes("relation") && message.includes("contact_leads")) {
    return "Falta la tabla contact_leads en Supabase. Ejecuta el SQL actualizado de supabase/schema.sql.";
  }
  if (message.includes("row-level security")) {
    return "Permisos insuficientes en Supabase. Revisa SUPABASE_SERVICE_ROLE_KEY y politicas.";
  }
  return message;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const realIp = request.headers.get("x-real-ip") || "";
  const candidate = forwardedFor.split(",")[0]?.trim() || realIp.trim();
  return candidate || "unknown";
}

function consumeRateLimit(ip: string) {
  const now = Date.now();
  const existing = requestLog.get(ip) || { hits: [], blockedUntil: 0 };

  if (existing.blockedUntil > now) {
    return { allowed: false };
  }

  const hits = existing.hits.filter((ts) => now - ts < WINDOW_MS);
  hits.push(now);

  if (hits.length > MAX_REQUESTS_PER_WINDOW) {
    requestLog.set(ip, { hits, blockedUntil: now + BLOCK_MS });
    return { allowed: false };
  }

  requestLog.set(ip, { hits, blockedUntil: 0 });

  // Limpieza basica para evitar crecimiento infinito del mapa.
  if (requestLog.size > 2000) {
    for (const [key, entry] of requestLog.entries()) {
      const recentHits = entry.hits.filter((ts) => now - ts < WINDOW_MS);
      if (!recentHits.length && entry.blockedUntil < now) {
        requestLog.delete(key);
      } else {
        requestLog.set(key, { hits: recentHits, blockedUntil: entry.blockedUntil });
      }
    }
  }

  return { allowed: true };
}

function isSafeOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}
