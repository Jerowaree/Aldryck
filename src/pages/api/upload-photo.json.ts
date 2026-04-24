import type { APIRoute } from "astro";
import { requireAdminUser, unauthorizedResponse } from "../../lib/adminAuth";
import { uploadPhotoAndCreateRecord } from "../../lib/portfolio";
import { getServerSupabaseAdminClient } from "../../lib/supabase";
import {
  getUploadFileTypeError,
  MAX_UPLOAD_FILE_COUNT,
} from "../../lib/uploadValidation";

export const GET: APIRoute = async () => jsonError("Metodo no permitido.", 405);

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await requireAdminUser(request);
    if (!user) return unauthorizedResponse();

    const formData = await request.formData();

    const imageUrl = String(formData.get("imageUrl") || "");
    const imagePath = String(formData.get("imagePath") || "");
    const files = formData
      .getAll("file")
      .filter((item) => item instanceof File) as File[];
    const title = String(formData.get("title") || "");
    const categoryId = String(formData.get("categoryId") || "");
    const description = String(formData.get("description") || "");
    const shotAt = String(formData.get("shotAt") || "");
    const isPublished =
      String(formData.get("isPublished") || "false") === "true";

    if (!files.length && !imageUrl) {
      return jsonError("El archivo o la URL de imagen es requerida.", 400);
    }

    if (files.length > MAX_UPLOAD_FILE_COUNT) {
      return jsonError(
        `Solo se permiten hasta ${MAX_UPLOAD_FILE_COUNT} archivos por subida.`,
        400,
      );
    }

    for (const file of files) {
      const typeError = getUploadFileTypeError(file);
      if (typeError) return jsonError(typeError, 400);
    }

    if ((files.length === 1 || imageUrl) && !title) {
      return jsonError("title es obligatorio.", 400);
    }

    if (!categoryId) {
      return jsonError("categoryId es obligatorio.", 400);
    }

    const supabase = getServerSupabaseAdminClient();
    const photos = [];

    // Si ya tenemos la URL (subida directa desde el cliente)
    if (imageUrl && imagePath) {
      const { data, error } = await supabase
        .from("photos")
        .insert({
          title,
          category_id: categoryId,
          description: description || null,
          image_path: imagePath,
          image_url: imageUrl,
          is_published: isPublished,
          shot_at: shotAt || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      photos.push(data);
    } else {
      // Subida tradicional (sujeta a límites de Vercel)
      for (const file of files) {
        const resolvedTitle =
          files.length > 1 ? titleFromFilename(file.name) : title;
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
    }

    const data = photos.length > 1 ? photos : photos[0];
    return new Response(JSON.stringify({ data }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 201,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? normalizeUploadError(error.message)
        : "No se pudo subir la foto.";
    return jsonError(message, 500);
  }
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status,
  });
}

function titleFromFilename(filename: string) {
  const base = filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
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
