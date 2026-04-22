import type { APIRoute } from "astro";
import {
  createCategory,
  deleteCategoryById,
  fetchCategories,
  updateCategory,
} from "../../lib/portfolio";
import { requireAdminUser, unauthorizedResponse } from "../../lib/adminAuth";
import {
  getServerSupabaseClient,
} from "../../lib/supabase";

export const GET: APIRoute = async () => {
  try {
    const supabase = getServerSupabaseClient();
    const categories = await fetchCategories(supabase);

    return new Response(JSON.stringify({ data: categories }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "No se pudieron cargar las categorias.",
        detail: error instanceof Error ? error.message : "unknown",
      }),
      {
        headers: { "content-type": "application/json; charset=utf-8" },
        status: 500,
      },
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAdminUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const name = String(body?.name || "");
    const slug = body?.slug ? String(body.slug) : undefined;

    if (!name.trim()) {
      return jsonError("El nombre de la categoria es obligatorio.", 400);
    }

    const supabase = getServerSupabaseClient();
    const category = await createCategory(supabase, { name, slug });

    return new Response(JSON.stringify({ data: category }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 201,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "No se pudo crear la categoria.",
      500
    );
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const user = await requireAdminUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const id = String(body?.id || "");
    const name = body?.name ? String(body.name) : undefined;
    const slug = body?.slug ? String(body.slug) : undefined;

    if (!id.trim()) {
      return jsonError("El id de la categoria es obligatorio.", 400);
    }

    const supabase = getServerSupabaseClient();
    const category = await updateCategory(supabase, id, { name, slug });

    return new Response(JSON.stringify({ data: category }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 200,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "No se pudo actualizar la categoria.",
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
      return jsonError("El id de la categoria es obligatorio.", 400);
    }

    const supabase = getServerSupabaseClient();
    await deleteCategoryById(supabase, id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? normalizeCategoryError(error.message) : "No se pudo eliminar la categoria.";
    const status = message.includes("uso por fotos") ? 409 : 500;
    return jsonError(message, status);
  }
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status,
  });
}

function normalizeCategoryError(message: string) {
  if (message.includes("violates foreign key constraint")) {
    return "No se puede eliminar: esta categoria esta en uso por fotos.";
  }
  if (message.includes("row-level security")) {
    return "Permisos insuficientes para gestionar categorias.";
  }
  return message;
}
