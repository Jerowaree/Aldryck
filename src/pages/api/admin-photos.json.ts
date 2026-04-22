import type { APIRoute } from "astro";
import { requireAdminUser, unauthorizedResponse } from "../../lib/adminAuth";
import {
  deletePhotoById,
  fetchPhotosForAdmin,
  updatePhotoById,
} from "../../lib/portfolio";
import { getServerSupabaseAdminClient } from "../../lib/supabase";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await requireAdminUser(request);
    if (!user) return unauthorizedResponse();

    const supabase = getServerSupabaseAdminClient();
    const photos = await fetchPhotosForAdmin(supabase, 80);

    return new Response(JSON.stringify({ data: photos }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 200,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? normalizePhotoAdminError(error.message)
        : "No se pudieron cargar las fotos.",
      500
    );
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const user = await requireAdminUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const id = String(body?.id || "");

    if (!id.trim()) {
      return jsonError("El id de la foto es obligatorio.", 400);
    }

    const supabase = getServerSupabaseAdminClient();
    await deletePhotoById(supabase, id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 200,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? normalizePhotoAdminError(error.message)
        : "No se pudo eliminar la foto.";
    const status = message.includes("no encontrada") ? 404 : 500;
    return jsonError(message, status);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const user = await requireAdminUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const id = String(body?.id || "");
    const title = String(body?.title || "");
    const description = String(body?.description || "");
    const categoryId = String(body?.categoryId || "");
    const isPublished = Boolean(body?.isPublished);

    if (!id.trim()) {
      return jsonError("El id de la foto es obligatorio.", 400);
    }

    const supabase = getServerSupabaseAdminClient();
    const updated = await updatePhotoById(supabase, {
      id,
      title,
      description,
      categoryId,
      isPublished,
    });

    return new Response(JSON.stringify({ data: updated }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 200,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? normalizePhotoAdminError(error.message)
        : "No se pudo actualizar la foto.";
    const status = message.includes("invalido")
      ? 400
      : message.includes("no encontrada")
        ? 404
        : 500;
    return jsonError(message, status);
  }
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status,
  });
}

function normalizePhotoAdminError(message: string) {
  if (message.includes("row-level security")) {
    return "Permisos insuficientes en Supabase para gestionar fotos.";
  }
  return message;
}
