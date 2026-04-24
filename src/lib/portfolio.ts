import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBucketName } from "./supabase";

export type Category = {
  id: string;
  slug: string;
  name: string;
  created_at?: string;
};

export type Photo = {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  image_path: string;
  image_url: string;
  is_published: boolean;
  shot_at: string | null;
  created_at: string;
};

export type UploadPhotoInput = {
  file: File;
  title: string;
  categoryId: string;
  description?: string;
  isPublished?: boolean;
  shotAt?: string;
};

export type ContactLead = {
  id: string;
  name: string;
  email: string;
  project: string;
  message: string;
  created_at: string;
};

export async function fetchCategories(client: SupabaseClient) {
  const { data, error } = await client
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as Category[];
}

type CreateCategoryInput = {
  name: string;
  slug?: string;
};

export async function createCategory(
  client: SupabaseClient,
  input: CreateCategoryInput
) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("El nombre de la categoria es obligatorio.");
  }

  const slug = (input.slug?.trim() || slugify(name)).toLowerCase();

  const { data, error } = await client
    .from("categories")
    .insert({ name, slug })
    .select("*")
    .single();

  if (error) throw error;
  return data as Category;
}

export async function deleteCategoryById(client: SupabaseClient, categoryId: string) {
  const id = categoryId.trim();
  if (!id) throw new Error("ID de categoria invalido.");

  const { error } = await client.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCategory(
  client: SupabaseClient,
  id: string,
  input: Partial<CreateCategoryInput>
) {
  const name = input.name?.trim();
  const slug = input.slug?.trim();

  const updateData: any = {};
  if (name) updateData.name = name;
  if (slug) updateData.slug = slug.toLowerCase();

  const { data, error } = await client
    .from("categories")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Category;
}

export async function fetchPublishedPhotos(client: SupabaseClient) {
  const { data, error } = await client
    .from("photos")
    .select("*")
    .eq("is_published", true)
    .order("shot_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Photo[];
}

type FetchPublishedPhotosPageOptions = {
  page: number;
  limit: number;
  categoryId?: string;
};

export async function fetchPublishedPhotosPage(
  client: SupabaseClient,
  options: FetchPublishedPhotosPageOptions
) {
  const page = Math.max(1, options.page);
  const limit = Math.min(24, Math.max(1, options.limit));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = client
    .from("photos")
    .select("*", { count: "exact" })
    .eq("is_published", true)
    .order("shot_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (options.categoryId) {
    query = query.eq("category_id", options.categoryId);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) throw error;

  const total = count || 0;
  const loaded = from + (data?.length || 0);
  const hasMore = loaded < total;

  return {
    data: (data || []) as Photo[],
    pagination: {
      page,
      limit,
      total,
      hasMore,
    },
  };
}

export async function uploadPhotoAndCreateRecord(
  client: SupabaseClient,
  input: UploadPhotoInput,
) {
  const bucket = getSupabaseBucketName();
  const filePath = createStoragePath(input.file.name);

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(filePath, input.file, { upsert: false });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = client.storage
    .from(bucket)
    .getPublicUrl(filePath);

  const { data, error } = await client
    .from("photos")
    .insert({
      title: input.title,
      category_id: input.categoryId,
      description: input.description || null,
      image_path: filePath,
      image_url: publicUrlData.publicUrl,
      is_published: input.isPublished ?? false,
      shot_at: input.shotAt || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Photo;
}

type CreateContactLeadInput = {
  name: string;
  email: string;
  project: string;
  message: string;
};

export async function createContactLead(
  client: SupabaseClient,
  input: CreateContactLeadInput
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const project = input.project.trim();
  const message = input.message.trim();

  if (name.length < 2 || name.length > 80) {
    throw new Error("Nombre invalido.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) {
    throw new Error("Correo invalido.");
  }

  if (project.length < 4 || project.length > 120) {
    throw new Error("Tipo de trabajo invalido.");
  }

  if (message.length < 20 || message.length > 300) {
    throw new Error("Mensaje invalido.");
  }

  const { data, error } = await client
    .from("contact_leads")
    .insert({ name, email, project, message })
    .select("*")
    .single();

  if (error) throw error;
  return data as ContactLead;
}

export async function fetchContactLeads(client: SupabaseClient, limit = 50) {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const { data, error } = await client
    .from("contact_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return (data || []) as ContactLead[];
}

export async function fetchPhotosForAdmin(client: SupabaseClient, limit = 60) {
  const safeLimit = Math.min(200, Math.max(1, limit));
  const { data, error } = await client
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return (data || []) as Photo[];
}

export async function deletePhotoById(client: SupabaseClient, photoId: string) {
  const id = photoId.trim();
  if (!id) {
    throw new Error("ID de foto invalido.");
  }

  const { data: photo, error: readError } = await client
    .from("photos")
    .select("id,image_path")
    .eq("id", id)
    .maybeSingle();

  if (readError) throw readError;
  if (!photo) {
    throw new Error("Foto no encontrada.");
  }

  const bucket = getSupabaseBucketName();
  const { error: storageError } = await client.storage
    .from(bucket)
    .remove([photo.image_path]);

  if (storageError) throw storageError;

  const { error: deleteError } = await client.from("photos").delete().eq("id", id);
  if (deleteError) throw deleteError;
}

type UpdatePhotoInput = {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  isPublished: boolean;
};

export async function updatePhotoById(
  client: SupabaseClient,
  input: UpdatePhotoInput
) {
  const id = input.id.trim();
  const title = input.title.trim();
  const description = (input.description || "").trim();
  const categoryId = input.categoryId.trim();

  if (!id) throw new Error("ID de foto invalido.");
  if (title.length < 2 || title.length > 120) {
    throw new Error("Titulo invalido.");
  }
  if (!categoryId) {
    throw new Error("Categoria invalida.");
  }
  if (description.length > 300) {
    throw new Error("Descripcion invalida.");
  }

  const { data, error } = await client
    .from("photos")
    .update({
      title,
      description: description || null,
      category_id: categoryId,
      is_published: input.isPublished,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Foto no encontrada.");
  return data as Photo;
}

export function createStoragePath(filename: string) {
  const ext = filename.includes(".") ? filename.split(".").pop() : "jpg";
  const id = crypto.randomUUID();
  const dateFolder = new Date().toISOString().split("T")[0];
  return `gallery/${dateFolder}/${id}.${ext}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
