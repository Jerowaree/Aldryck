interface Category {
  id: string;
  name: string;
}

interface Photo {
  id: string;
  title: string;
  description?: string;
  image_url: string;
  category_id: string;
}

export function initGalleryGrid() {
  const root = document.querySelector("[data-gallery-root]");
  if (!root) throw new Error("Gallery root missing");

  const grid = document.getElementById("gallery-grid");
  const filterContainer = document.getElementById("category-filters");
  const loadMoreButton = document.getElementById("gallery-load-more");
  const status = document.getElementById("gallery-status");
  const lightbox = document.getElementById("gallery-lightbox");
  const lightboxImage = document.getElementById("lightbox-image");
  const lightboxTitle = document.getElementById("lightbox-title");
  const lightboxCategory = document.getElementById("lightbox-category");
  const lightboxClose = document.getElementById("lightbox-close");

  if (
    !grid ||
    !filterContainer ||
    !(loadMoreButton instanceof HTMLButtonElement) ||
    !status ||
    !(lightbox instanceof HTMLDialogElement) ||
    !(lightboxImage instanceof HTMLImageElement) ||
    !lightboxTitle ||
    !lightboxCategory ||
    !(lightboxClose instanceof HTMLButtonElement)
  ) {
    throw new Error("Gallery UI missing");
  }

  const state = {
    page: 1,
    pageSize: Number((root as HTMLElement).dataset.pageSize || "9"),
    hasMore: true,
    loading: false,
    category: "all",
  };

  const liBase =
    "group relative min-h-[260px] overflow-hidden rounded-lg bg-surface-elevated ring-1 ring-white/5 content-visibility-auto sm:min-h-[240px] sm:rounded-xl";

  const labelByCategory = new Map<string, string>();

  const setStatus = (text: string) => {
    status.textContent = text;
  };

  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const cardClass = (indexInBatch: number) => {
    if (indexInBatch === 0 && state.page === 1 && state.category === "all") {
      return `${liBase} lg:col-span-2`;
    }
    return liBase;
  };

  const renderPhotos = (photos: Photo[]) => {
    if (!photos.length && state.page === 1) {
      grid.innerHTML =
        '<li class="rounded-xl border border-line bg-surface-elevated p-6 text-sm text-ink-muted">No hay fotos publicadas en esta categoría todavía.</li>';
      return;
    }

    const fragment = document.createDocumentFragment();

    photos.forEach((photo: Photo, index) => {
      const item = document.createElement("li");
      item.className = cardClass(index);

      const categoryLabel = labelByCategory.get(photo.category_id) || "Colección";
      const safeCategory = escapeHtml(categoryLabel);
      const safeTitle = escapeHtml(photo.title);
      const safeDescription = escapeHtml(photo.description || photo.title);

      item.innerHTML = `
        <article class="relative h-full min-h-[inherit]">
          <button
            type="button"
            data-photo-trigger
            data-image-url="${photo.image_url}"
            data-image-alt="${safeDescription}"
            data-photo-title="${safeTitle}"
            data-photo-category="${safeCategory}"
            class="absolute inset-0 text-left"
            aria-label="Ver ${safeTitle} en grande"
          >
            <img
              src="${photo.image_url}"
              alt="${safeDescription}"
              width="800"
              height="1000"
              loading="lazy"
              decoding="async"
              class="absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform group-hover:scale-[1.008] group-hover:brightness-[0.98]"
            />
            <div class="pointer-events-none absolute inset-0 bg-linear-to-t from-surface/65 via-surface/16 to-transparent opacity-76 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-80"></div>
            <div class="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <p class="text-xs font-semibold uppercase tracking-wider text-accent/90">${safeCategory}</p>
              <h3 class="font-display text-2xl tracking-wide text-ink drop-shadow-md sm:text-3xl">${safeTitle}</h3>
            </div>
          </button>
        </article>
      `;

      fragment.appendChild(item);
    });

    grid.appendChild(fragment);
  };

  const loadCategories = async () => {
    const response = await fetch("/api/categories.json");
    const contentType = response.headers.get("content-type");
    if (!response.ok || !contentType?.includes("application/json")) throw new Error("No se pudieron cargar categorías");
    const json = await response.json();
    const categories = (Array.isArray(json.data) ? json.data : []) as Category[];

    categories.forEach((category: Category) => {
      labelByCategory.set(category.id, category.name);
    });

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.dataset.category = "all";
    allButton.className =
      "category-chip snap-start rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-colors duration-150";
    allButton.textContent = "Todas";
    filterContainer.appendChild(allButton);

    categories.forEach((category: Category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.category = category.id;
      button.className =
        "category-chip snap-start rounded-full border border-line bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted transition-colors duration-150 hover:border-accent/40 hover:text-ink";
      button.textContent = category.name;
      filterContainer.appendChild(button);
    });
  };

  const updateActiveFilter = () => {
    const chips = filterContainer.querySelectorAll(".category-chip");
    chips.forEach((chip) => {
      const active = (chip as HTMLElement).dataset.category === state.category;
      (chip as HTMLElement).className = active
        ? "category-chip snap-start rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink transition-colors duration-150"
        : "category-chip snap-start rounded-full border border-line bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted transition-colors duration-150 hover:border-accent/40 hover:text-ink";
    });
  };

  const loadPage = async () => {
    if (state.loading || !state.hasMore) return;
    state.loading = true;
    loadMoreButton.disabled = true;
    setStatus("Cargando fotos...");

    const url = new URL("/api/gallery.json", window.location.origin);
    url.searchParams.set("page", String(state.page));
    url.searchParams.set("limit", String(state.pageSize));
    if (state.category !== "all") {
      url.searchParams.set("category", state.category);
    }

    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType?.includes("application/json")) throw new Error("Error al cargar fotos");
      const json = await response.json();
      const photos = (Array.isArray(json.data) ? json.data : []) as Photo[];
      renderPhotos(photos);

      state.hasMore = Boolean(json.pagination?.hasMore);
      state.page += 1;
      setStatus(
        state.hasMore
          ? "Pulsa la flecha para cargar más."
          : photos.length
            ? "No hay más fotos por ahora."
            : "",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo cargar la galería.");
      state.hasMore = false;
    } finally {
      state.loading = false;
      loadMoreButton.disabled = !state.hasMore;
    }
  };

  filterContainer.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const category = target.dataset.category;
    if (!category || category === state.category) return;

    state.category = category;
    state.page = 1;
    state.hasMore = true;
    grid.innerHTML = "";
    updateActiveFilter();
    await loadPage();
  });

  loadMoreButton.addEventListener("click", () => {
    loadPage();
  });

  grid.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest("[data-photo-trigger]");
    if (!(trigger instanceof HTMLButtonElement)) return;

    lightboxImage.src = trigger.dataset.imageUrl || "";
    lightboxImage.alt = trigger.dataset.imageAlt || "Fotografía ampliada";
    lightboxTitle.textContent = trigger.dataset.photoTitle || "Fotografía";
    lightboxCategory.textContent = trigger.dataset.photoCategory || "Colección";
    lightbox.showModal();
  });

  lightboxClose.addEventListener("click", () => lightbox.close());

  lightbox.addEventListener("click", (event) => {
    const dialogRect = lightbox.getBoundingClientRect();
    const clickedOutside =
      event.clientX < dialogRect.left ||
      event.clientX > dialogRect.right ||
      event.clientY < dialogRect.top ||
      event.clientY > dialogRect.bottom;
    if (clickedOutside) lightbox.close();
  });

  const init = async () => {
    await loadCategories();
    updateActiveFilter();
    await loadPage();
  };

  init();
}
