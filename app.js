const STORAGE_KEY = "closet-daily-items";
const OUTFIT_KEY = "closet-daily-outfit";
const SLOT_ORDER = [
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
  { key: "shoes", label: "Shoes" },
  { key: "accessory", label: "Accessory" },
];

let wardrobeItems = [];
let outfitSelection = {};
let rawPhotoData = "";
let cleanPhotoData = "";

document.addEventListener("DOMContentLoaded", () => {
  wardrobeItems = loadJson(STORAGE_KEY, []);
  outfitSelection = loadJson(OUTFIT_KEY, {});

  bindUploadFlow();
  bindFilters();
  bindOutfitActions();
  renderInventory();
  renderOutfitBuilder();
  registerServiceWorker();
});

function bindUploadFlow() {
  const form = document.getElementById("itemForm");
  const photoInput = document.getElementById("photoInput");
  const autoCleanBtn = document.getElementById("autoCleanBtn");

  if (!form || !photoInput || !autoCleanBtn) return;

  photoInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Cleaning the photo for a white-background wardrobe card...");
    rawPhotoData = await fileToDataUrl(file);
    setImage("rawPreview", rawPhotoData);

    try {
      cleanPhotoData = await cleanWardrobePhoto(rawPhotoData);
      setImage("cleanPreview", cleanPhotoData);
      setStatus("Photo cleaned. Review it and save the item.");
    } catch {
      cleanPhotoData = rawPhotoData;
      setImage("cleanPreview", cleanPhotoData);
      setStatus("Cleaning failed, so the original image will be used.", true);
    }
  });

  autoCleanBtn.addEventListener("click", async () => {
    if (!rawPhotoData) {
      setStatus("Capture or import a photo first.", true);
      return;
    }

    setStatus("Reprocessing photo...");
    cleanPhotoData = await cleanWardrobePhoto(rawPhotoData);
    setImage("cleanPreview", cleanPhotoData);
    setStatus("Photo reprocessed.");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);

    if (!cleanPhotoData && !rawPhotoData) {
      setStatus("A clothing photo is required.", true);
      return;
    }

    const item = {
      id: crypto.randomUUID(),
      name: value(formData, "name"),
      category: value(formData, "category"),
      type: value(formData, "type"),
      color: value(formData, "color"),
      occasion: value(formData, "occasion"),
      season: value(formData, "season"),
      notes: value(formData, "notes"),
      image: cleanPhotoData || rawPhotoData,
      createdAt: new Date().toISOString(),
    };

    wardrobeItems.unshift(item);
    persistWardrobe();
    form.reset();
    rawPhotoData = "";
    cleanPhotoData = "";
    setImage("rawPreview", "");
    setImage("cleanPreview", "");
    setStatus("Item saved to your wardrobe.");
    renderInventory();
    renderOutfitBuilder();
  });
}

function bindFilters() {
  const categoryFilter = document.getElementById("categoryFilter");
  const searchFilter = document.getElementById("searchFilter");
  categoryFilter?.addEventListener("change", renderInventory);
  searchFilter?.addEventListener("input", renderInventory);
}

function bindOutfitActions() {
  document.getElementById("generateOutfitBtn")?.addEventListener("click", () => {
    SLOT_ORDER.forEach((slot) => {
      const candidates = wardrobeItems.filter((item) => item.category === slot.key);
      outfitSelection[slot.key] = candidates.length ? sample(candidates).id : "";
    });
    persistOutfit();
    renderOutfitBuilder();
  });

  document.getElementById("clearOutfitBtn")?.addEventListener("click", () => {
    outfitSelection = {};
    persistOutfit();
    renderOutfitBuilder();
  });
}

function renderInventory() {
  const grid = document.getElementById("inventoryGrid");
  const empty = document.getElementById("inventoryEmpty");
  const template = document.getElementById("inventoryCardTemplate");
  const categoryFilter = document.getElementById("categoryFilter")?.value || "all";
  const searchFilter = (document.getElementById("searchFilter")?.value || "").trim().toLowerCase();

  if (!grid || !empty || !template) return;

  const filteredItems = wardrobeItems.filter((item) => {
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const searchText = `${item.name} ${item.type} ${item.color} ${item.occasion}`.toLowerCase();
    const matchesSearch = !searchFilter || searchText.includes(searchFilter);
    return matchesCategory && matchesSearch;
  });

  grid.innerHTML = "";
  empty.style.display = filteredItems.length ? "none" : "block";

  filteredItems.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".wardrobe-card");
    const image = fragment.querySelector(".wardrobe-image");
    const name = fragment.querySelector(".wardrobe-name");
    const meta = fragment.querySelector(".wardrobe-meta");
    const note = fragment.querySelector(".wardrobe-note");
    const tags = fragment.querySelector(".wardrobe-tags");
    const assignBtn = fragment.querySelector(".assign-btn");
    const deleteBtn = fragment.querySelector(".danger");

    image.src = item.image;
    image.alt = item.name;
    name.textContent = item.name;
    meta.textContent = [categoryLabel(item.category), item.type, item.color].filter(Boolean).join(" • ");
    note.textContent = item.notes || "No styling notes yet.";

    [item.occasion, item.season].filter(Boolean).forEach((tagText) => {
      const tag = document.createElement("span");
      tag.className = "chip";
      tag.textContent = tagText;
      tags.appendChild(tag);
    });

    assignBtn.addEventListener("click", () => {
      outfitSelection[item.category] = item.id;
      persistOutfit();
      renderOutfitBuilder();
    });

    deleteBtn.addEventListener("click", () => {
      wardrobeItems = wardrobeItems.filter((candidate) => candidate.id !== item.id);
      Object.keys(outfitSelection).forEach((slotKey) => {
        if (outfitSelection[slotKey] === item.id) outfitSelection[slotKey] = "";
      });
      persistWardrobe();
      persistOutfit();
      renderInventory();
      renderOutfitBuilder();
    });

    grid.appendChild(card);
  });

  setCounter("totalItems", wardrobeItems.length);
}

function renderOutfitBuilder() {
  const grid = document.getElementById("outfitGrid");
  const template = document.getElementById("outfitSlotTemplate");
  if (!grid || !template) return;

  grid.innerHTML = "";

  SLOT_ORDER.forEach((slot) => {
    const fragment = template.content.cloneNode(true);
    const label = fragment.querySelector(".slot-label");
    const title = fragment.querySelector(".slot-title");
    const card = fragment.querySelector(".slot-card");
    const image = fragment.querySelector(".slot-image");
    const itemName = fragment.querySelector(".slot-item-name");
    const itemMeta = fragment.querySelector(".slot-item-meta");
    const select = fragment.querySelector(".slot-select");
    const matchingItems = wardrobeItems.filter((item) => item.category === slot.key);
    const selectedItem = matchingItems.find((item) => item.id === outfitSelection[slot.key]);

    label.textContent = slot.label;
    title.textContent = selectedItem ? "Selected" : "Choose an item";

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = matchingItems.length ? `Select ${slot.label.toLowerCase()}` : `No ${slot.label.toLowerCase()}s saved`;
    select.appendChild(placeholderOption);

    matchingItems.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.name}${item.color ? ` • ${item.color}` : ""}`;
      option.selected = item.id === outfitSelection[slot.key];
      select.appendChild(option);
    });

    if (selectedItem) {
      card.classList.remove("empty");
      image.src = selectedItem.image;
      image.alt = selectedItem.name;
      itemName.textContent = selectedItem.name;
      itemMeta.textContent = [selectedItem.type, selectedItem.color, selectedItem.occasion].filter(Boolean).join(" • ");
    } else {
      card.classList.add("empty");
      image.removeAttribute("src");
      image.alt = "";
      itemName.textContent = "Not selected";
      itemMeta.textContent = "Your outfit will appear here.";
    }

    select.addEventListener("change", () => {
      outfitSelection[slot.key] = select.value;
      persistOutfit();
      renderOutfitBuilder();
    });

    grid.appendChild(fragment);
  });

  const selectedCount = SLOT_ORDER.filter((slot) => outfitSelection[slot.key]).length;
  setCounter("selectedOutfitCount", selectedCount);
}

async function cleanWardrobePhoto(source) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const background = detectBackgroundColor(data, canvas.width, canvas.height);
  const threshold = 42;

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const distance = colorDistance(
        data[index],
        data[index + 1],
        data[index + 2],
        background.r,
        background.g,
        background.b,
      );

      if (distance < threshold) {
        data[index] = 255;
        data[index + 1] = 255;
        data[index + 2] = 255;
      } else {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  context.putImageData(imageData, 0, 0);

  if (minX >= maxX || minY >= maxY) {
    minX = 0;
    minY = 0;
    maxX = canvas.width;
    maxY = canvas.height;
  }

  const cropPadding = 40;
  const cropX = Math.max(0, minX - cropPadding);
  const cropY = Math.max(0, minY - cropPadding);
  const cropWidth = Math.min(canvas.width - cropX, maxX - minX + cropPadding * 2);
  const cropHeight = Math.min(canvas.height - cropY, maxY - minY + cropPadding * 2);

  const output = document.createElement("canvas");
  const outputSize = 1200;
  output.width = outputSize;
  output.height = outputSize;
  const out = output.getContext("2d");

  out.fillStyle = "#ffffff";
  out.fillRect(0, 0, outputSize, outputSize);

  const scale = Math.min(outputSize * 0.78 / cropWidth, outputSize * 0.78 / cropHeight);
  const drawWidth = cropWidth * scale;
  const drawHeight = cropHeight * scale;
  const drawX = (outputSize - drawWidth) / 2;
  const drawY = (outputSize - drawHeight) / 2;

  out.shadowColor = "rgba(22, 28, 45, 0.12)";
  out.shadowBlur = 28;
  out.shadowOffsetY = 18;
  out.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, drawX, drawY, drawWidth, drawHeight);
  out.shadowColor = "transparent";

  return output.toDataURL("image/jpeg", 0.92);
}

function detectBackgroundColor(data, width, height) {
  const borderSamples = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 40));

  for (let x = 0; x < width; x += step) {
    borderSamples.push(readPixel(data, width, x, 0));
    borderSamples.push(readPixel(data, width, x, height - 1));
  }

  for (let y = 0; y < height; y += step) {
    borderSamples.push(readPixel(data, width, 0, y));
    borderSamples.push(readPixel(data, width, width - 1, y));
  }

  const total = borderSamples.reduce(
    (sum, sample) => ({
      r: sum.r + sample.r,
      g: sum.g + sample.g,
      b: sum.b + sample.b,
    }),
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: total.r / borderSamples.length,
    g: total.g / borderSamples.length,
    b: total.b / borderSamples.length,
  };
}

function readPixel(data, width, x, y) {
  const index = (y * width + x) * 4;
  return { r: data[index], g: data[index + 1], b: data[index + 2] };
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function persistWardrobe() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wardrobeItems));
}

function persistOutfit() {
  localStorage.setItem(OUTFIT_KEY, JSON.stringify(outfitSelection));
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setImage(id, source) {
  const node = document.getElementById(id);
  if (!node) return;
  if (!source) {
    node.removeAttribute("src");
    return;
  }
  node.src = source;
}

function setStatus(message, isError = false) {
  const node = document.getElementById("formStatus");
  if (!node) return;
  node.textContent = message;
  node.dataset.error = isError ? "true" : "false";
}

function setCounter(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value);
}

function value(formData, key) {
  return String(formData.get(key) || "").trim();
}

function categoryLabel(category) {
  const match = SLOT_ORDER.find((slot) => slot.key === category);
  return match ? match.label : category;
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}
