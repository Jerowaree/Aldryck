import type { APIRoute } from "astro";
import { requireAdminUser, unauthorizedResponse } from "../../lib/adminAuth";
import { uploadPhotoAndCreateRecord } from "../../lib/portfolio";
import { getServerSupabaseAdminClient } from "../../lib/supabase";

export const GET: APIRoute = async () => jsonError("Metodo no permitido.", 405);

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAdminUser(request);
    if (!user) return unauthorizedResponse();

    const formData = await request.formData();

    const files = formData.getAll("file").filter((item) => item instanceof File) as File[];
    const title = String(formData.get("title") || "");
    const categoryId = String(formData.get("categoryId") || "");
    const description = String(formData.get("description") || "");
    const shotAt = String(formData.get("shotAt") || "");
    const isPublished =
      String(formData.get("isPublished") || "false") === "true";

    if (!files.length) {
      return jsonError("El archivo es requerido.", 400);
    }

    if (files.length > 15) {
      return jsonError("Solo se permiten hasta 15 archivos por subida.", 400);
    }

    const allowedMimeTypes = new Set(["image/jpeg", "image/png"]);
    const allowedExtensions = new Set(["jpg", "jpeg", "png"]);
    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      const isMimeAllowed = file.type ? allowedMimeTypes.has(file.type) : false;
      const isExtensionAllowed = allowedExtensions.has(extension);
      if (!isMimeAllowed && !isExtensionAllowed) {
        return jsonError("Solo se permiten imagenes JPG o PNG.", 400);
      }
    }

    if (files.length === 1 && !title) {
      return jsonError("title es obligatorio si subes una sola foto.", 400);
    }

    if (!categoryId) {
      return jsonError("categoryId es obligatorio.", 400);
    }

    const supabase = getServerSupabaseAdminClient();
    const photos = [];
    for (const file of files) {
      const resolvedTitle = files.length > 1 ? titleFromFilename(file.name) : title;
      const photo = await uploadPhotoAndCreateRecord(supabase, {
        file,
        title: resolvedTitle,
        categoryId,
        description: description || undefined,
        shotAt: shotAt || undefined,
        isPublished,
      });
      photos.push(photo);
    }

    const data = files.length > 1 ? photos : photos[0];
    return new Response(JSON.stringify({ data }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 201,
    });
  } catch (error) {
    const message =
      error instanceof Error ? normalizeUploadError(error.message) : "No se pudo subir la foto.";
    return jsonError(
      message,
      500,
    );
  }
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status,
  });
}

function titleFromFilename(filename: string) {
  const base = filename.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base || "Sin titulo";
}

function normalizeUploadError(message: string) {
  if (message.includes("row-level security")) {
    return "No se pudo guardar por permisos de Supabase. Revisa que SUPABASE_SERVICE_ROLE_KEY esté configurada en producción.";
  }
  if (message.includes("Payload Too Large") || message.includes("413")) {
    return "La imagen es demasiado pesada para el servidor.";
  }
  if (message.includes("Storage quenching") || message.includes("quota")) {
    return "Límite de almacenamiento de Supabase alcanzado.";
  }
  // Log the real error for the admin to see if they check the response
  console.error("[Upload API Error]:", message);
  return `Error detallado: ${message}`;
}
