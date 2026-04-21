import { useEffect, useState } from "react";

const STORAGE_KEY = "closet-daily-items";
const OUTFIT_KEY = "closet-daily-outfit";
const SLOT_ORDER = [
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
  { key: "shoes", label: "Shoes" },
  { key: "accessory", label: "Accessory" },
];

const INITIAL_FORM = {
  name: "",
  category: "top",
  type: "",
  color: "",
  occasion: "Everyday",
  season: "All season",
  notes: "",
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function categoryLabel(category) {
  const match = SLOT_ORDER.find((slot) => slot.key === category);
  return match ? match.label : category;
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function valueOrBlank(value) {
  return value || undefined;
}

async function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readPixel(data, width, x, y) {
  const index = (y * width + x) * 4;
  return { r: data[index], g: data[index + 1], b: data[index + 2] };
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
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
    (sum, pixel) => ({
      r: sum.r + pixel.r,
      g: sum.g + pixel.g,
      b: sum.b + pixel.b,
    }),
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: total.r / borderSamples.length,
    g: total.g / borderSamples.length,
    b: total.b / borderSamples.length,
  };
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

function InventoryCard({ item, onAssign, onDelete }) {
  return (
    <article className="wardrobe-card">
      <img className="wardrobe-image" alt={item.name} src={item.image} />
      <div className="wardrobe-body">
        <div className="wardrobe-topline">
          <div>
            <h3 className="wardrobe-name">{item.name}</h3>
            <p className="wardrobe-meta">
              {[categoryLabel(item.category), item.type, item.color].filter(Boolean).join(" / ")}
            </p>
          </div>
          <button className="danger small" type="button" onClick={() => onDelete(item.id)}>
            Delete
          </button>
        </div>
        <p className="wardrobe-note">{item.notes || "No styling notes yet."}</p>
        <div className="wardrobe-tags">
          {[item.occasion, item.season].filter(Boolean).map((tag) => (
            <span key={tag} className="chip">
              {tag}
            </span>
          ))}
        </div>
        <button className="ghost assign-btn" type="button" onClick={() => onAssign(item)}>
          Use In Outfit
        </button>
      </div>
    </article>
  );
}

function OutfitSlot({ slot, item, options, onSelect }) {
  return (
    <article className="outfit-slot">
      <div>
        <p className="slot-label">{slot.label}</p>
        <h3 className="slot-title">{item ? "Selected" : "Choose an item"}</h3>
      </div>
      <div className={`slot-card${item ? "" : " empty"}`}>
        <img className="slot-image" alt={item?.name || ""} src={valueOrBlank(item?.image)} />
        <div className="slot-text">
          <strong className="slot-item-name">{item ? item.name : "Not selected"}</strong>
          <span className="slot-item-meta">
            {item
              ? [item.type, item.color, item.occasion].filter(Boolean).join(" / ")
              : "Your outfit will appear here."}
          </span>
        </div>
      </div>
      <select className="slot-select" value={item?.id || ""} onChange={(event) => onSelect(slot.key, event.target.value)}>
        <option value="">
          {options.length ? `Select ${slot.label.toLowerCase()}` : `No ${slot.label.toLowerCase()}s saved`}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
            {option.color ? ` / ${option.color}` : ""}
          </option>
        ))}
      </select>
    </article>
  );
}

export default function App() {
  const [wardrobeItems, setWardrobeItems] = useState(() => loadJson(STORAGE_KEY, []));
  const [outfitSelection, setOutfitSelection] = useState(() => loadJson(OUTFIT_KEY, {}));
  const [form, setForm] = useState(INITIAL_FORM);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [rawPhotoData, setRawPhotoData] = useState("");
  const [cleanPhotoData, setCleanPhotoData] = useState("");
  const [status, setStatus] = useState({ message: "", error: false });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wardrobeItems));
  }, [wardrobeItems]);

  useEffect(() => {
    localStorage.setItem(OUTFIT_KEY, JSON.stringify(outfitSelection));
  }, [outfitSelection]);

  const filteredItems = wardrobeItems.filter((item) => {
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const searchText = `${item.name} ${item.type} ${item.color} ${item.occasion}`.toLowerCase();
    const matchesSearch = !searchFilter.trim() || searchText.includes(searchFilter.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setStatus({
      message: "Cleaning the photo for a white-background wardrobe card...",
      error: false,
    });

    const rawData = await fileToDataUrl(file);
    setRawPhotoData(rawData);

    try {
      const cleanData = await cleanWardrobePhoto(rawData);
      setCleanPhotoData(cleanData);
      setStatus({ message: "Photo cleaned. Review it and save the item.", error: false });
    } catch {
      setCleanPhotoData(rawData);
      setStatus({
        message: "Cleaning failed, so the original image will be used.",
        error: true,
      });
    }
  }

  async function handleReprocessPhoto() {
    if (!rawPhotoData) {
      setStatus({ message: "Capture or import a photo first.", error: true });
      return;
    }

    setStatus({ message: "Reprocessing photo...", error: false });

    try {
      const cleanData = await cleanWardrobePhoto(rawPhotoData);
      setCleanPhotoData(cleanData);
      setStatus({ message: "Photo reprocessed.", error: false });
    } catch {
      setStatus({ message: "Photo reprocessing failed.", error: true });
    }
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetUploadForm() {
    setForm(INITIAL_FORM);
    setRawPhotoData("");
    setCleanPhotoData("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!cleanPhotoData && !rawPhotoData) {
      setStatus({ message: "A clothing photo is required.", error: true });
      return;
    }

    const item = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      category: form.category.trim(),
      type: form.type.trim(),
      color: form.color.trim(),
      occasion: form.occasion.trim(),
      season: form.season.trim(),
      notes: form.notes.trim(),
      image: cleanPhotoData || rawPhotoData,
      createdAt: new Date().toISOString(),
    };

    if (!item.name) {
      setStatus({ message: "Item name is required.", error: true });
      return;
    }

    setWardrobeItems((current) => [item, ...current]);
    resetUploadForm();
    setStatus({ message: "Item saved to your wardrobe.", error: false });
  }

  function handleAssignToOutfit(item) {
    setOutfitSelection((current) => ({ ...current, [item.category]: item.id }));
  }

  function handleDeleteItem(itemId) {
    setWardrobeItems((current) => current.filter((candidate) => candidate.id !== itemId));
    setOutfitSelection((current) => {
      const next = { ...current };
      Object.keys(next).forEach((slotKey) => {
        if (next[slotKey] === itemId) {
          next[slotKey] = "";
        }
      });
      return next;
    });
  }

  function handleSlotSelect(slotKey, itemId) {
    setOutfitSelection((current) => ({ ...current, [slotKey]: itemId }));
  }

  function handleGenerateOutfit() {
    const next = {};

    SLOT_ORDER.forEach((slot) => {
      const candidates = wardrobeItems.filter((item) => item.category === slot.key);
      next[slot.key] = candidates.length ? sample(candidates).id : "";
    });

    setOutfitSelection(next);
  }

  function handleClearOutfit() {
    setOutfitSelection({});
  }

  const selectedOutfitCount = SLOT_ORDER.filter((slot) => outfitSelection[slot.key]).length;

  return (
    <div className="app-shell">
      <header className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">iPhone Wardrobe App</p>
          <h1>Capture your clothes. Build today&apos;s outfit.</h1>
          <p>
            Photograph a shirt, shoe, or accessory, clean it into a white-background product photo, save it to
            your wardrobe, and mix looks directly on your phone.
          </p>
        </div>

        <div className="hero-stats">
          <article className="stat-card">
            <span>Total Items</span>
            <strong>{wardrobeItems.length}</strong>
          </article>
          <article className="stat-card">
            <span>Today&apos;s Outfit</span>
            <strong>{selectedOutfitCount}</strong>
          </article>
        </div>
      </header>

      <main className="main-stack">
        <section className="panel upload-panel">
          <div className="section-head">
            <div>
              <p className="section-kicker">Add To Wardrobe</p>
              <h2>Capture or import an item</h2>
            </div>
            <p className="section-copy">
              Use your iPhone camera, then auto-clean the image into a white e-commerce style card.
            </p>
          </div>

          <form className="item-form" onSubmit={handleSubmit}>
            <label className="upload-dropzone">
              <input
                accept="image/*"
                capture="environment"
                name="photo"
                required
                type="file"
                onChange={handlePhotoChange}
              />
              <span className="upload-title">Tap to capture a clothing photo</span>
              <span className="upload-subtitle">
                Best results: place the item on a plain surface with light around it.
              </span>
            </label>

            <div className="preview-shell">
              <div className="preview-card">
                <span className="preview-label">Original</span>
                <img alt="Original clothing preview" src={valueOrBlank(rawPhotoData)} />
              </div>
              <div className="preview-card refined">
                <span className="preview-label">Store-style result</span>
                <img alt="Cleaned clothing preview" src={valueOrBlank(cleanPhotoData)} />
              </div>
            </div>

            <div className="control-grid">
              <label>
                Item name
                <input
                  name="name"
                  placeholder="White Oxford Shirt"
                  required
                  type="text"
                  value={form.name}
                  onChange={handleFieldChange}
                />
              </label>

              <label>
                Category
                <select name="category" value={form.category} onChange={handleFieldChange}>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="shoes">Shoes</option>
                  <option value="accessory">Accessory</option>
                  <option value="layer">Layer</option>
                </select>
              </label>

              <label>
                Type
                <input
                  name="type"
                  placeholder="Shirt, T-shirt, Denim, Sneaker"
                  type="text"
                  value={form.type}
                  onChange={handleFieldChange}
                />
              </label>

              <label>
                Color
                <input
                  name="color"
                  placeholder="White, Black, Olive"
                  type="text"
                  value={form.color}
                  onChange={handleFieldChange}
                />
              </label>

              <label>
                Occasion
                <select name="occasion" value={form.occasion} onChange={handleFieldChange}>
                  <option value="Everyday">Everyday</option>
                  <option value="Office">Office</option>
                  <option value="Evening">Evening</option>
                  <option value="Travel">Travel</option>
                  <option value="Workout">Workout</option>
                  <option value="Festive">Festive</option>
                </select>
              </label>

              <label>
                Season
                <select name="season" value={form.season} onChange={handleFieldChange}>
                  <option value="All season">All season</option>
                  <option value="Summer">Summer</option>
                  <option value="Monsoon">Monsoon</option>
                  <option value="Winter">Winter</option>
                </select>
              </label>

              <label className="full-span">
                Notes
                <textarea
                  name="notes"
                  placeholder="Relaxed fit, works with loafers, best for casual Fridays"
                  rows="3"
                  value={form.notes}
                  onChange={handleFieldChange}
                />
              </label>
            </div>

            <div className="action-row">
              <button className="primary" type="submit">
                Save To Wardrobe
              </button>
              <button className="ghost" type="button" onClick={handleReprocessPhoto}>
                Reprocess Photo
              </button>
            </div>

            <p className="form-status" data-error={status.error ? "true" : "false"}>
              {status.message}
            </p>
          </form>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="section-kicker">Inventory</p>
              <h2>Your wardrobe</h2>
            </div>
            <div className="filter-row">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                <option value="top">Tops</option>
                <option value="bottom">Bottoms</option>
                <option value="shoes">Shoes</option>
                <option value="accessory">Accessories</option>
                <option value="layer">Layers</option>
              </select>
              <input
                placeholder="Search by item, type, or color"
                type="search"
                value={searchFilter}
                onChange={(event) => setSearchFilter(event.target.value)}
              />
            </div>
          </div>

          {!filteredItems.length && (
            <div className="empty-state">
              {wardrobeItems.length
                ? "No items match the current filters."
                : "No wardrobe items yet. Capture your first piece above."}
            </div>
          )}

          <div className="inventory-grid">
            {filteredItems.map((item) => (
              <InventoryCard key={item.id} item={item} onAssign={handleAssignToOutfit} onDelete={handleDeleteItem} />
            ))}
          </div>
        </section>

        <section className="panel outfit-panel">
          <div className="section-head">
            <div>
              <p className="section-kicker">Outfit Builder</p>
              <h2>Create your look for the day</h2>
            </div>
            <div className="action-row compact">
              <button className="primary" type="button" onClick={handleGenerateOutfit}>
                Suggest Outfit
              </button>
              <button className="ghost" type="button" onClick={handleClearOutfit}>
                Clear
              </button>
            </div>
          </div>

          <div className="outfit-grid">
            {SLOT_ORDER.map((slot) => {
              const options = wardrobeItems.filter((item) => item.category === slot.key);
              const selectedItem = options.find((item) => item.id === outfitSelection[slot.key]);

              return (
                <OutfitSlot
                  key={slot.key}
                  item={selectedItem}
                  onSelect={handleSlotSelect}
                  options={options}
                  slot={slot}
                />
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
