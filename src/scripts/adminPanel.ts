import { getBrowserSupabaseClient } from "../lib/supabase";
import {
  getUploadFileSizeError,
  getUploadFileTypeError,
  MAX_UPLOAD_FILE_COUNT,
} from "../lib/uploadValidation";

export function initAdminPanel(allowedAdminEmails: string[]) {
  const categoryForm = document.getElementById("category-form");
  const photoForm = document.getElementById("photo-form");
  const categorySelect = document.getElementById("category-select");
  const categoryList = document.getElementById("category-list");
  const statusEl = document.getElementById("admin-status");
  const leadList = document.getElementById("lead-list");
  const leadStatus = document.getElementById("lead-status");
  const refreshLeadsButton = document.getElementById("refresh-leads");
  const photoList = document.getElementById("photo-list");
  const photoStatus = document.getElementById("photo-status");
  const photoLoadMoreButton = document.getElementById("photo-load-more");
  const refreshPhotosButton = document.getElementById("refresh-photos");
  const photoFilterQuery = document.getElementById("photo-filter-query");
  const photoFilterCategory = document.getElementById("photo-filter-category");
  const editPhotoModal = document.getElementById("edit-photo-modal");
  const editPhotoForm = document.getElementById("edit-photo-form");
  const editPhotoId = document.getElementById("edit-photo-id");
  const editPhotoTitle = document.getElementById("edit-photo-title");
  const editPhotoDescription = document.getElementById(
    "edit-photo-description",
  );
  const editPhotoCategory = document.getElementById("edit-photo-category");
  const editPhotoPublished = document.getElementById("edit-photo-published");
  const editPhotoStatus = document.getElementById("edit-photo-status");
  const closeEditModalButton = document.getElementById("close-edit-modal");
  const cancelEditModalButton = document.getElementById("cancel-edit-modal");
  const saveEditModalButton = document.getElementById("save-edit-modal");

  const editCategoryModal = document.getElementById("edit-category-modal");
  const editCategoryForm = document.getElementById("edit-category-form");
  const editCategoryIdInput = document.getElementById("edit-category-id");
  const editCategoryNameInput = document.getElementById("edit-category-name");
  const cancelEditCategoryButton = document.getElementById(
    "cancel-edit-category-modal",
  );
  const saveCategoryButton = document.getElementById("save-category-button");

  const deleteConfirmModal = document.getElementById("delete-confirm-modal");
  const cancelDeleteModalButton = document.getElementById(
    "cancel-delete-modal",
  );
  const confirmDeleteButton = document.getElementById("confirm-delete-button");
  const deleteConfirmMessage = document.getElementById(
    "delete-confirm-message",
  );

  const logoutButton = document.getElementById("admin-logout");

  if (
    !(categoryForm instanceof HTMLFormElement) ||
    !(photoForm instanceof HTMLFormElement) ||
    !(categorySelect instanceof HTMLSelectElement) ||
    !(categoryList instanceof HTMLUListElement) ||
    !(statusEl instanceof HTMLElement) ||
    !(photoList instanceof HTMLUListElement) ||
    !(photoStatus instanceof HTMLElement) ||
    !(photoLoadMoreButton instanceof HTMLButtonElement) ||
    !(photoFilterQuery instanceof HTMLInputElement) ||
    !(photoFilterCategory instanceof HTMLSelectElement) ||
    !(editPhotoModal instanceof HTMLDialogElement) ||
    !(editPhotoForm instanceof HTMLFormElement) ||
    !(editPhotoId instanceof HTMLInputElement) ||
    !(editPhotoTitle instanceof HTMLInputElement) ||
    !(editPhotoDescription instanceof HTMLTextAreaElement) ||
    !(editPhotoCategory instanceof HTMLSelectElement) ||
    !(editPhotoPublished instanceof HTMLInputElement) ||
    !(editPhotoStatus instanceof HTMLElement) ||
    !(closeEditModalButton instanceof HTMLButtonElement) ||
    !(cancelEditModalButton instanceof HTMLButtonElement) ||
    !(saveEditModalButton instanceof HTMLButtonElement) ||
    !(editCategoryModal instanceof HTMLDialogElement) ||
    !(editCategoryForm instanceof HTMLFormElement) ||
    !(editCategoryIdInput instanceof HTMLInputElement) ||
    !(editCategoryNameInput instanceof HTMLInputElement) ||
    !(cancelEditCategoryButton instanceof HTMLButtonElement) ||
    !(saveCategoryButton instanceof HTMLButtonElement) ||
    !(deleteConfirmModal instanceof HTMLDialogElement) ||
    !(cancelDeleteModalButton instanceof HTMLButtonElement) ||
    !(confirmDeleteButton instanceof HTMLButtonElement) ||
    !(deleteConfirmMessage instanceof HTMLElement) ||
    !(logoutButton instanceof HTMLButtonElement) ||
    !(leadList instanceof HTMLElement) ||
    !(leadStatus instanceof HTMLElement)
  ) {
    throw new Error("Admin UI no disponible");
  }

  const errorModal = document.getElementById("error-modal") as HTMLDialogElement;
  const errorModalMessage = document.getElementById("error-modal-message");

  const showError = (message: string) => {
    if (errorModal && errorModalMessage) {
      errorModalMessage.textContent = message;
      errorModal.showModal();
    } else {
      alert(message);
    }
  };

  const setStatus = (text: string) => (statusEl.textContent = text);
  const setLeadStatus = (text: string) => (leadStatus.textContent = text);
  const setPhotoStatus = (text: string) => (photoStatus.textContent = text);

  const categoryNameById = new Map<string, string>();
  let allPhotos: any[] = [];
  let filteredPhotos: any[] = [];
  const photosPageSize = 10;
  let visiblePhotosCount = photosPageSize;
  let accessToken = "";
  const supabase = getBrowserSupabaseClient();

  let pendingDeleteAction: (() => Promise<void>) | null = null;
  const showDeleteConfirm = (message: string, action: () => Promise<void>) => {
    deleteConfirmMessage.textContent = message;
    pendingDeleteAction = action;
    deleteConfirmModal.showModal();
  };

  const closeDeleteModal = () => {
    deleteConfirmModal.close();
    pendingDeleteAction = null;
  };

  cancelDeleteModalButton.addEventListener("click", closeDeleteModal);
  confirmDeleteButton.addEventListener("click", async () => {
    if (pendingDeleteAction) {
      confirmDeleteButton.disabled = true;
      try {
        await pendingDeleteAction();
      } finally {
        confirmDeleteButton.disabled = false;
        closeDeleteModal();
      }
    }
  });

  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const adminFetch = async (
    input: RequestInfo | URL,
    init: RequestInit = {},
  ) => {
    if (!accessToken)
      throw new Error("Sesion expirada. Inicia sesión nuevamente.");
    const headers = new Headers(init.headers || {});
    headers.set("authorization", `Bearer ${accessToken}`);
    const response = await fetch(input, { ...init, headers });
    if (response.status === 401) {
      await supabase.auth.signOut();
      window.location.href = "/admin-login";
    }
    return response;
  };

  const loadCategories = async () => {
    const response = await fetch("/api/categories.json");
    const json = await response.json();
    const categories = Array.isArray(json.data) ? json.data : [];

    categorySelect.innerHTML =
      '<option value="">Selecciona una categoría</option>';
    categoryList.innerHTML = "";
    photoFilterCategory.innerHTML =
      '<option value="all">Todas las categorías</option>';
    editPhotoCategory.innerHTML = "";

    categories.forEach((category: any) => {
      categoryNameById.set(category.id, category.name);
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);

      const item = document.createElement("li");
      item.className =
        "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs uppercase tracking-wider text-ink-muted";
      item.innerHTML = `<span>${escapeHtml(category.name)}</span>
        <div class="flex gap-1.5 ml-1">
          <button type="button" data-edit-category="${escapeHtml(category.id)}" data-category-name="${escapeHtml(category.name)}" class="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted hover:text-ink">Editar</button>
          <button type="button" data-delete-category="${escapeHtml(category.id)}" class="rounded-md border border-red-400/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-normal text-red-200 transition-colors hover:bg-red-500/20">Eliminar</button>
        </div>`;
      categoryList.appendChild(item);

      const filterOption = document.createElement("option");
      filterOption.value = category.id;
      filterOption.textContent = category.name;
      photoFilterCategory.appendChild(filterOption);

      const editOption = document.createElement("option");
      editOption.value = category.id;
      editOption.textContent = category.name;
      editPhotoCategory.appendChild(editOption);
    });
  };

  const loadContactLeads = async () => {
    setLeadStatus("Cargando consultas...");
    const response = await adminFetch("/api/contact-leads.json");
    const json = await response.json();
    if (!response.ok)
      return setLeadStatus(
        json.error || "No se pudieron cargar las consultas.",
      );

    const leads = Array.isArray(json.data) ? json.data : [];
    leadList.innerHTML = "";
    if (!leads.length) {
      leadList.innerHTML =
        '<tr><td colspan="5" class="px-3 py-4 text-sm text-ink-muted">No hay consultas todavía.</td></tr>';
      return setLeadStatus("Sin consultas por ahora.");
    }

    leads.forEach((lead: any) => {
      const date = new Date(lead.created_at);
      const row = document.createElement("tr");
      row.className = "align-top";
      row.innerHTML = `<td class="border-b border-line/70 px-3 py-3 text-xs text-ink-muted whitespace-nowrap">${date.toLocaleString("es-PE")}</td><td class="border-b border-line/70 px-3 py-3 text-sm text-ink">${escapeHtml(lead.name || "")}</td><td class="border-b border-line/70 px-3 py-3 text-sm text-ink"><a href="mailto:${encodeURIComponent(lead.email || "")}" class="text-ink hover:text-accent">${escapeHtml(lead.email || "")}</a></td><td class="border-b border-line/70 px-3 py-3 text-sm text-ink-muted">${escapeHtml(lead.project || "")}</td><td class="border-b border-line/70 px-3 py-3 text-sm leading-relaxed text-ink-muted">${escapeHtml(lead.message || "")}</td>`;
      leadList.appendChild(row);
    });
    setLeadStatus(`${leads.length} consulta(s) cargada(s).`);
  };

  const updatePhotoLoadMoreState = () => {
    const hasMore = visiblePhotosCount < filteredPhotos.length;
    photoLoadMoreButton.disabled = !hasMore;
    photoLoadMoreButton.classList.toggle("hidden", filteredPhotos.length === 0);
  };

  const renderPhotos = () => {
    const query = photoFilterQuery.value.trim().toLowerCase();
    const categoryFilter = photoFilterCategory.value;
    filteredPhotos = allPhotos.filter((photo) => {
      const title = String(photo.title || "").toLowerCase();
      return (
        (!query || title.includes(query)) &&
        (categoryFilter === "all" || photo.category_id === categoryFilter)
      );
    });

    photoList.innerHTML = "";
    if (!filteredPhotos.length) {
      updatePhotoLoadMoreState();
      photoList.innerHTML =
        '<li class="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-muted sm:col-span-2">No se encontraron fotos con los filtros actuales.</li>';
      return setPhotoStatus("Sin resultados con estos filtros.");
    }

    const visiblePhotos = filteredPhotos.slice(0, visiblePhotosCount);
    visiblePhotos.forEach((photo) => {
      const item = document.createElement("li");
      item.className =
        "flex gap-3 rounded-xl border border-line bg-surface p-3";
      const createdAt = new Date(photo.created_at).toLocaleString("es-PE");
      const categoryName =
        categoryNameById.get(photo.category_id) || "Sin categoría";
      item.innerHTML = `<img src="${escapeHtml(photo.image_url || "")}" alt="${escapeHtml(photo.title || "Foto")}" class="h-20 w-20 rounded-lg object-cover" loading="lazy" decoding="async" /><div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-ink">${escapeHtml(photo.title || "Sin título")}</p><p class="mt-1 text-xs text-ink-muted">${createdAt}</p><p class="mt-1 text-xs text-ink-muted">${escapeHtml(categoryName)}</p><p class="mt-1 text-xs uppercase tracking-wider ${photo.is_published ? "text-emerald-300" : "text-amber-300"}">${photo.is_published ? "Publicada" : "Borrador"}</p></div><button type="button" data-edit-photo="${escapeHtml(photo.id || "")}" class="self-start rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-accent/40 hover:text-ink">Editar</button><button type="button" data-delete-photo="${escapeHtml(photo.id || "")}" class="self-start rounded-md border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20">Eliminar</button>`;
      photoList.appendChild(item);
    });
    updatePhotoLoadMoreState();
    setPhotoStatus(
      `${visiblePhotos.length} de ${filteredPhotos.length} foto(s) mostrada(s).`,
    );
  };

  const loadPhotos = async () => {
    setPhotoStatus("Cargando fotos...");
    const response = await adminFetch("/api/admin-photos.json");
    const json = await response.json();
    if (!response.ok)
      return setPhotoStatus(json.error || "No se pudieron cargar las fotos.");
    allPhotos = Array.isArray(json.data) ? json.data : [];
    visiblePhotosCount = photosPageSize;
    renderPhotos();
  };

  categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Creando categoría...");
    const formData = new FormData(categoryForm);
    const response = await adminFetch("/api/categories.json", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") || ""),
        slug: String(formData.get("slug") || ""),
      }),
    });
    const json = await response.json();
    if (!response.ok)
      return setStatus(
        json.error || "No se pudo crear la categoría. Inténtalo de nuevo.",
      );
    categoryForm.reset();
    await loadCategories();
    setStatus("Categoría creada con éxito.");
  });

  photoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(photoForm);
    const files = formData
      .getAll("file")
      .filter((item) => item instanceof File) as File[];
    const title = String(formData.get("title") || "").trim();
    if (!files.length) {
      setStatus("Error: Debes seleccionar al menos una imagen.");
      return;
    }
    if (files.length > MAX_UPLOAD_FILE_COUNT) {
      setStatus(
        `Error: Solo se permiten hasta ${MAX_UPLOAD_FILE_COUNT} archivos por subida.`,
      );
      return;
    }
    if (files.length === 1 && !title) {
      setStatus("Error: El titulo es obligatorio si subes una sola foto.");
      return;
    }
    for (const file of files) {
      const fileTypeError = getUploadFileTypeError(file);
      if (fileTypeError) {
        setStatus(`Error: ${fileTypeError}`);
        return;
      }
      const fileSizeError = getUploadFileSizeError(file);
      if (fileSizeError) {
        showError(fileSizeError);
        return;
      }
    }

    const setUploadLoading = (loading: boolean) => {
      const submitBtn = photoForm.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.disabled = loading;
        submitBtn.innerHTML = loading
          ? '<span class="flex items-center gap-2"><svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Subiendo...</span>'
          : "Subir foto";
      }
    };

    setStatus("Subiendo foto...");
    setUploadLoading(true);
    formData.set("isPublished", "true");
    const shotAtValue = String(formData.get("shotAt") || "");
    if (shotAtValue)
      formData.set("shotAt", new Date(shotAtValue).toISOString());

    try {
      const response = await adminFetch("/api/upload-photo.json", {
        method: "POST",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok) {
        showError(json.error || "Revisa los campos e inténtalo de nuevo");
        setStatus("❌ Error al subir");
        return;
      }

      photoForm.reset();
      await loadPhotos();
      setStatus("✅ Foto subida con éxito.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error de red";
      setStatus(`❌ Error crítico: ${msg}. Verifica tu conexión a internet.`);
    } finally {
      setUploadLoading(false);
    }
  });

  categoryList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const editBtn = target.closest("[data-edit-category]");
    if (editBtn instanceof HTMLButtonElement) {
      const categoryId = editBtn.dataset.editCategory || "";
      const currentName = editBtn.dataset.categoryName || "";

      editCategoryIdInput.value = categoryId;
      editCategoryNameInput.value = currentName;
      editCategoryModal.showModal();
      editCategoryNameInput.focus();
      return;
    }

    const button = target.closest("[data-delete-category]");
    if (!(button instanceof HTMLButtonElement)) return;
    const categoryId = button.dataset.deleteCategory;
    if (!categoryId) return;

    showDeleteConfirm(
      "Se eliminará la categoría. Solo funcionará si no tiene fotos asociadas. ¿Continuar?",
      async () => {
        button.disabled = true;
        setStatus("Eliminando categoría...");
        try {
          const response = await adminFetch("/api/categories.json", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: categoryId }),
          });
          const json = await response.json();
          if (!response.ok) {
            setStatus(json.error || "No se pudo eliminar la categoría.");
            button.disabled = false;
            return;
          }
          await loadCategories();
          await loadPhotos();
          setStatus("Categoría eliminada con éxito.");
        } catch (error) {
          setStatus(
            error instanceof Error
              ? error.message
              : "No se pudo eliminar la categoría.",
          );
          button.disabled = false;
        }
      },
    );
  });

  photoList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const editButton = target.closest("[data-edit-photo]");
    if (editButton instanceof HTMLButtonElement) {
      const current = allPhotos.find(
        (photo) => photo.id === editButton.dataset.editPhoto,
      );
      if (!current) return setPhotoStatus("No se encontró la foto a editar.");
      editPhotoId.value = current.id;
      editPhotoTitle.value = current.title || "";
      editPhotoDescription.value = current.description || "";
      editPhotoCategory.value = current.category_id || "";
      editPhotoPublished.checked = Boolean(current.is_published);
      editPhotoStatus.textContent = "";
      editPhotoModal.showModal();
      editPhotoTitle.focus();
      return;
    }

    const button = target.closest("[data-delete-photo]");
    if (!(button instanceof HTMLButtonElement)) return;
    const photoId = button.dataset.deletePhoto;
    if (!photoId) return;

    showDeleteConfirm(
      "Esta acción eliminará la foto del panel y del storage. ¿Deseas continuar?",
      async () => {
        button.disabled = true;
        setPhotoStatus("Eliminando foto...");
        try {
          const response = await adminFetch("/api/admin-photos.json", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: photoId }),
          });
          const json = await response.json();
          if (!response.ok) {
            setPhotoStatus(json.error || "No se pudo eliminar la foto.");
            button.disabled = false;
            return;
          }
          await loadPhotos();
          setPhotoStatus("Foto eliminada con éxito.");
        } catch (error) {
          setPhotoStatus(
            error instanceof Error
              ? error.message
              : "No se pudo eliminar la foto.",
          );
          button.disabled = false;
        }
      },
    );
  });

  const closeEditModal = () => {
    editPhotoForm.reset();
    editPhotoStatus.textContent = "";
    editPhotoModal.close();
  };
  closeEditModalButton.addEventListener("click", closeEditModal);
  cancelEditModalButton.addEventListener("click", closeEditModal);

  const closeEditCategoryModal = () => {
    editCategoryForm.reset();
    editCategoryModal.close();
  };
  cancelEditCategoryButton.addEventListener("click", closeEditCategoryModal);

  editCategoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = editCategoryIdInput.value;
    const newName = editCategoryNameInput.value.trim();
    if (!id || !newName) return;

    saveCategoryButton.disabled = true;
    setStatus("Actualizando categoría...");
    try {
      const response = await adminFetch("/api/categories.json", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, name: newName }),
      });
      if (!response.ok) {
        const json = await response.json();
        setStatus(json.error || "No se pudo actualizar la categoría.");
        return;
      }
      await loadCategories();
      await loadPhotos();
      setStatus("✅ Categoría actualizada con éxito.");
      closeEditCategoryModal();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Error al actualizar categoría",
      );
    } finally {
      saveCategoryButton.disabled = false;
    }
  });

  editPhotoModal.addEventListener("click", (event) => {
    const rect = editPhotoModal.getBoundingClientRect();
    const clickedOutside =
      (event as MouseEvent).clientX < rect.left ||
      (event as MouseEvent).clientX > rect.right ||
      (event as MouseEvent).clientY < rect.top ||
      (event as MouseEvent).clientY > rect.bottom;
    if (clickedOutside) closeEditModal();
  });

  editPhotoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = editPhotoId.value.trim();
    const title = editPhotoTitle.value.trim();
    const categoryId = editPhotoCategory.value;
    if (!id || !title || !categoryId)
      return (editPhotoStatus.textContent =
        "Completa los campos obligatorios.");
    saveEditModalButton.disabled = true;
    editPhotoStatus.textContent = "Guardando cambios...";
    try {
      const response = await adminFetch("/api/admin-photos.json", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          title,
          description: editPhotoDescription.value.trim(),
          categoryId,
          isPublished: editPhotoPublished.checked,
        }),
      });
      const json = await response.json();
      if (!response.ok)
        return (editPhotoStatus.textContent =
          json.error || "No se pudo actualizar la foto.");
      await loadPhotos();
      closeEditModal();
      setPhotoStatus("Foto actualizada con éxito.");
    } catch (error) {
      editPhotoStatus.textContent =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la foto.";
    } finally {
      saveEditModalButton.disabled = false;
    }
  });

  refreshLeadsButton?.addEventListener("click", () => {
    loadContactLeads().catch((error) =>
      setLeadStatus(
        error instanceof Error ? error.message : "Error cargando consultas.",
      ),
    );
  });
  refreshPhotosButton?.addEventListener("click", () => {
    loadPhotos().catch((error) =>
      setPhotoStatus(
        error instanceof Error ? error.message : "Error cargando fotos.",
      ),
    );
  });
  photoLoadMoreButton.addEventListener("click", () => {
    visiblePhotosCount += photosPageSize;
    renderPhotos();
  });
  photoFilterQuery.addEventListener("input", () => {
    visiblePhotosCount = photosPageSize;
    renderPhotos();
  });
  photoFilterCategory.addEventListener("change", () => {
    visiblePhotosCount = photosPageSize;
    renderPhotos();
  });
  logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
    document.cookie = "admin_auth=; Path=/; Max-Age=0; SameSite=Lax";
    window.location.href = "/admin-login";
  });

  const bootstrapAdmin = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return (window.location.href = "/admin-login");
    const sessionEmail = (data.session.user.email || "").toLowerCase();
    if (!allowedAdminEmails.includes(sessionEmail)) {
      await supabase.auth.signOut();
      document.cookie = "admin_auth=; Path=/; Max-Age=0; SameSite=Lax";
      return (window.location.href = "/admin-login");
    }
    document.cookie = "admin_auth=1; Path=/; Max-Age=86400; SameSite=Lax";
    accessToken = data.session.access_token;
    await loadCategories();
    await Promise.all([loadContactLeads(), loadPhotos()]);
    setStatus("Todo listo. Ya puedes crear, editar y eliminar contenido.");
  };

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) return (window.location.href = "/admin-login");
    const sessionEmail = (session.user.email || "").toLowerCase();
    if (!allowedAdminEmails.includes(sessionEmail)) {
      supabase.auth
        .signOut()
        .finally(() => (window.location.href = "/admin-login"));
      document.cookie = "admin_auth=; Path=/; Max-Age=0; SameSite=Lax";
      return;
    }
    document.cookie = "admin_auth=1; Path=/; Max-Age=86400; SameSite=Lax";
    accessToken = session.access_token;
  });

  bootstrapAdmin().catch((error) =>
    setStatus(error instanceof Error ? error.message : "Error cargando datos."),
  );
}
