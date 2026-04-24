"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import SignOutButton from "@/components/sign-out-button";

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

function categoryLabel(category) {
  return SLOT_ORDER.find((slot) => slot.key === category)?.label || category;
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function valueOrBlank(value) {
  return value || undefined;
}

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
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
    (sum, samplePixel) => ({
      r: sum.r + samplePixel.r,
      g: sum.g + samplePixel.g,
      b: sum.b + samplePixel.b,
    }),
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: total.r / borderSamples.length,
    g: total.g / borderSamples.length,
    b: total.b / borderSamples.length,
  };
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

  out.shadowColor = "rgba(23, 30, 44, 0.14)";
  out.shadowBlur = 30;
  out.shadowOffsetY = 20;
  out.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, drawX, drawY, drawWidth, drawHeight);

  return output.toDataURL("image/jpeg", 0.92);
}

function InventoryCard({ item, onAssign, onDelete }) {
  return (
    <article className="inventory-card">
      <img alt={item.name} className="inventory-image" src={item.image} />
      <div className="inventory-body">
        <div className="inventory-topline">
          <div>
            <h3>{item.name}</h3>
            <p>{[categoryLabel(item.category), item.type, item.color].filter(Boolean).join(" / ")}</p>
          </div>
          <button className="button subtle-danger small" onClick={() => onDelete(item.id)} type="button">
            Delete
          </button>
        </div>

        <div className="chip-row">
          {[item.occasion, item.season].filter(Boolean).map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <p className="inventory-note">{item.notes || "No styling notes yet."}</p>

        <button className="button ghost wide" onClick={() => onAssign(item)} type="button">
          Use In Outfit
        </button>
      </div>
    </article>
  );
}

function OutfitSlot({ item, options, slot, onSelect }) {
  return (
    <article className="slot-panel">
      <div className="slot-heading">
        <span>{slot.label}</span>
        <strong>{item ? "Selected" : "Open"}</strong>
      </div>

      <div className={`slot-card${item ? "" : " empty"}`}>
        <img alt={item?.name || ""} className="slot-image" src={valueOrBlank(item?.image)} />
        <div>
          <h3>{item ? item.name : `Choose ${slot.label.toLowerCase()}`}</h3>
          <p>{item ? [item.type, item.color, item.occasion].filter(Boolean).join(" / ") : "Saved items appear here."}</p>
        </div>
      </div>

      <select className="app-input" onChange={(event) => onSelect(slot.key, event.target.value)} value={item?.id || ""}>
        <option value="">
          {options.length ? `Select ${slot.label.toLowerCase()}` : `No ${slot.label.toLowerCase()} items yet`}
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

export default function ClosetDashboard({ session }) {
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [outfitSelection, setOutfitSelection] = useState({});
  const [form, setForm] = useState(INITIAL_FORM);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [rawPhotoData, setRawPhotoData] = useState("");
  const [cleanPhotoData, setCleanPhotoData] = useState("");
  const [status, setStatus] = useState({ message: "", error: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isSavingOutfit, setIsSavingOutfit] = useState(false);
  const deferredSearch = useDeferredValue(searchFilter);

  useEffect(() => {
    let cancelled = false;

    async function loadWardrobe() {
      try {
        const [itemsPayload, outfitPayload] = await Promise.all([
          fetch("/api/wardrobe/items", { cache: "no-store" }).then(parseJsonResponse),
          fetch("/api/wardrobe/outfit", { cache: "no-store" }).then(parseJsonResponse),
        ]);

        if (cancelled) {
          return;
        }

        setWardrobeItems(itemsPayload.items || []);
        setOutfitSelection(outfitPayload.outfit || {});
      } catch (error) {
        if (!cancelled) {
          setStatus({
            message: error instanceof Error ? error.message : "Unable to load your wardrobe.",
            error: true,
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadWardrobe();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return wardrobeItems.filter((item) => {
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const searchText = `${item.name} ${item.type} ${item.color} ${item.occasion}`.toLowerCase();
      const matchesSearch = !normalizedSearch || searchText.includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, deferredSearch, wardrobeItems]);

  const selectedOutfitCount = SLOT_ORDER.filter((slot) => outfitSelection[slot.key]).length;

  async function persistOutfit(selection, successMessage = "") {
    setIsSavingOutfit(true);

    try {
      const payload = await fetch("/api/wardrobe/outfit", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selection),
      }).then(parseJsonResponse);

      setOutfitSelection(payload.outfit || {});

      if (successMessage) {
        setStatus({ message: successMessage, error: false });
      }
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Unable to save outfit.",
        error: true,
      });
    } finally {
      setIsSavingOutfit(false);
    }
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus({ message: "Cleaning your photo into a storefront-style tile...", error: false });
    const rawData = await fileToDataUrl(file);
    setRawPhotoData(rawData);

    try {
      const refinedData = await cleanWardrobePhoto(rawData);
      setCleanPhotoData(refinedData);
      setStatus({ message: "Photo cleaned and ready to save.", error: false });
    } catch {
      setCleanPhotoData(rawData);
      setStatus({ message: "Photo cleaning failed, original image will be used.", error: true });
    }
  }

  async function handleReprocess() {
    if (!rawPhotoData) {
      setStatus({ message: "Capture or import a photo first.", error: true });
      return;
    }

    setStatus({ message: "Reprocessing photo...", error: false });

    try {
      const refinedData = await cleanWardrobePhoto(rawPhotoData);
      setCleanPhotoData(refinedData);
      setStatus({ message: "Photo reprocessed.", error: false });
    } catch {
      setStatus({ message: "Unable to reprocess this photo.", error: true });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSavingItem) {
      return;
    }

    if (!rawPhotoData && !cleanPhotoData) {
      setStatus({ message: "A clothing photo is required.", error: true });
      return;
    }

    if (!form.name.trim()) {
      setStatus({ message: "Item name is required.", error: true });
      return;
    }

    try {
      setIsSavingItem(true);
      const payload = await fetch("/api/wardrobe/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          imageData: cleanPhotoData || rawPhotoData,
        }),
      }).then(parseJsonResponse);

      setWardrobeItems((current) => [payload.item, ...current]);
      setForm(INITIAL_FORM);
      setRawPhotoData("");
      setCleanPhotoData("");
      setStatus({ message: "Saved to your wardrobe.", error: false });
      event.currentTarget.reset();
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Unable to save item.",
        error: true,
      });
    } finally {
      setIsSavingItem(false);
    }
  }

  function assignToOutfit(item) {
    const next = { ...outfitSelection, [item.category]: item.id };
    setOutfitSelection(next);
    persistOutfit(next, "Outfit updated.");
  }

  async function deleteItem(itemId) {
    try {
      await fetch(`/api/wardrobe/items/${itemId}`, {
        method: "DELETE",
      }).then(parseJsonResponse);

      setWardrobeItems((current) => current.filter((item) => item.id !== itemId));
      setOutfitSelection((current) => {
        const next = { ...current };
        Object.keys(next).forEach((slotKey) => {
          if (next[slotKey] === itemId) {
            next[slotKey] = "";
          }
        });
        return next;
      });
      setStatus({ message: "Item deleted.", error: false });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Unable to delete item.",
        error: true,
      });
    }
  }

  function generateOutfit() {
    const next = {};
    SLOT_ORDER.forEach((slot) => {
      const options = wardrobeItems.filter((item) => item.category === slot.key);
      next[slot.key] = options.length ? sample(options).id : "";
    });
    setOutfitSelection(next);
    persistOutfit(next, "Outfit suggestion saved.");
  }

  function handleOutfitSelection(slotKey, itemId) {
    const next = { ...outfitSelection, [slotKey]: itemId };
    setOutfitSelection(next);
    persistOutfit(next, "Outfit updated.");
  }

  return (
    <main className="dashboard-shell shell">
      <section className="dashboard-hero panel">
        <div>
          <p className="kicker">Authenticated Wardrobe</p>
          <h1>Welcome back, {session.user.name || session.user.email}.</h1>
          <p className="lede">
            Your wardrobe is private to your account. Capture garments, clean their photos, and build a look for the
            day without leaving the dashboard.
          </p>
        </div>

        <div className="hero-actions">
          <div className="metric-card">
            <span>Saved items</span>
            <strong>{isLoading ? "..." : wardrobeItems.length}</strong>
          </div>
          <div className="metric-card">
            <span>Current outfit</span>
            <strong>{isLoading ? "..." : `${selectedOutfitCount}/4`}</strong>
          </div>
          <SignOutButton />
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel compose-panel">
          <div className="section-head">
            <div>
              <p className="section-kicker">Capture</p>
              <h2>Add a new wardrobe item</h2>
            </div>
            <p>Best results come from clear lighting and a plain background.</p>
          </div>

          <form className="item-form" onSubmit={handleSubmit}>
            <label className="capture-dropzone">
              <input accept="image/*" capture="environment" onChange={handlePhotoChange} required type="file" />
              <span className="upload-title">Use camera or library</span>
              <span className="upload-subtitle">The app cleans the edges and centers the item on white.</span>
            </label>

            <div className="preview-grid">
              <div className="preview-card">
                <span>Original</span>
                <img alt="Original clothing preview" src={valueOrBlank(rawPhotoData)} />
              </div>
              <div className="preview-card polished">
                <span>Refined</span>
                <img alt="Processed clothing preview" src={valueOrBlank(cleanPhotoData)} />
              </div>
            </div>

            <div className="form-grid">
              <label>
                Item name
                <input
                  className="app-input"
                  name="name"
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Navy linen shirt"
                  required
                  type="text"
                  value={form.name}
                />
              </label>

              <label>
                Category
                <select
                  className="app-input"
                  name="category"
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  value={form.category}
                >
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="shoes">Shoes</option>
                  <option value="accessory">Accessory</option>
                </select>
              </label>

              <label>
                Type
                <input
                  className="app-input"
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                  placeholder="Shirt, denim, sneaker"
                  type="text"
                  value={form.type}
                />
              </label>

              <label>
                Color
                <input
                  className="app-input"
                  onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                  placeholder="Navy, white, tan"
                  type="text"
                  value={form.color}
                />
              </label>

              <label>
                Occasion
                <select
                  className="app-input"
                  onChange={(event) => setForm((current) => ({ ...current, occasion: event.target.value }))}
                  value={form.occasion}
                >
                  <option value="Everyday">Everyday</option>
                  <option value="Office">Office</option>
                  <option value="Evening">Evening</option>
                  <option value="Travel">Travel</option>
                  <option value="Festive">Festive</option>
                </select>
              </label>

              <label>
                Season
                <select
                  className="app-input"
                  onChange={(event) => setForm((current) => ({ ...current, season: event.target.value }))}
                  value={form.season}
                >
                  <option value="All season">All season</option>
                  <option value="Summer">Summer</option>
                  <option value="Monsoon">Monsoon</option>
                  <option value="Winter">Winter</option>
                </select>
              </label>

              <label className="full-span">
                Notes
                <textarea
                  className="app-input"
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Relaxed fit, works well with loafers and cream chinos"
                  rows="3"
                  value={form.notes}
                />
              </label>
            </div>

            <div className="button-row">
              <button className="button primary" disabled={isSavingItem} type="submit">
                {isSavingItem ? "Saving..." : "Save Item"}
              </button>
              <button className="button ghost" onClick={handleReprocess} type="button">
                Reprocess Photo
              </button>
            </div>

            <p className={`form-feedback${status.error ? " error" : ""}`}>
              {isLoading ? "Loading your wardrobe..." : status.message}
            </p>
          </form>
        </article>

        <article className="panel inventory-panel">
          <div className="section-head">
            <div>
              <p className="section-kicker">Inventory</p>
              <h2>Your wardrobe</h2>
            </div>
            <p>Filtered live as you type.</p>
          </div>

          <div className="toolbar">
            <select className="app-input" onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
              <option value="all">All categories</option>
              <option value="top">Tops</option>
              <option value="bottom">Bottoms</option>
              <option value="shoes">Shoes</option>
              <option value="accessory">Accessories</option>
            </select>

            <input
              className="app-input"
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="Search by item, type, or color"
              type="search"
              value={searchFilter}
            />
          </div>

          {isLoading ? (
            <div className="empty-state">Loading wardrobe...</div>
          ) : filteredItems.length ? (
            <div className="inventory-grid">
              {filteredItems.map((item) => (
                <InventoryCard item={item} key={item.id} onAssign={assignToOutfit} onDelete={deleteItem} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              {wardrobeItems.length ? "No items match the active filters." : "Capture your first wardrobe piece above."}
            </div>
          )}
        </article>
      </section>

      <section className="panel outfit-panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">Outfit Builder</p>
            <h2>Assemble today’s look</h2>
          </div>
          <div className="button-row">
            <button className="button primary" disabled={isLoading || isSavingOutfit} onClick={generateOutfit} type="button">
              {isSavingOutfit ? "Saving..." : "Suggest Outfit"}
            </button>
            <button
              className="button ghost"
              disabled={isLoading || isSavingOutfit}
              onClick={() => {
                const cleared = {};
                setOutfitSelection(cleared);
                persistOutfit(cleared, "Outfit cleared.");
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="slot-grid">
          {SLOT_ORDER.map((slot) => {
            const options = wardrobeItems.filter((item) => item.category === slot.key);
            const selectedItem = options.find((item) => item.id === outfitSelection[slot.key]);

            return (
              <OutfitSlot
                item={selectedItem}
                key={slot.key}
                onSelect={handleOutfitSelection}
                options={options}
                slot={slot}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
