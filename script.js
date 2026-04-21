const STORAGE_KEY = "inventor-app-products";
const PIN_KEY = "inventor-app-pin";

const productForm = document.getElementById("productForm");
const updateForm = document.getElementById("updateForm");
const productGrid = document.getElementById("productGrid");
const emptyState = document.getElementById("emptyState");
const updateEmptyState = document.getElementById("updateEmptyState");
const updateWorkspace = document.getElementById("updateWorkspace");
const updateProductSelect = document.getElementById("updateProductSelect");
const productCount = document.getElementById("productCount");
const imageFileInput = document.getElementById("imageFile");
const updateImageFileInput = document.getElementById("updateImageFile");
const pinInput = document.getElementById("pinInput");
const pinStatus = document.getElementById("pinStatus");
const setPinBtn = document.getElementById("setPinBtn");
const unlockBtn = document.getElementById("unlockBtn");
const lockBtn = document.getElementById("lockBtn");
const template = document.getElementById("productCardTemplate");
const navCards = document.querySelectorAll(".nav-card");
const screens = document.querySelectorAll("[data-screen]");

let products = loadProducts();
let costsUnlocked = false;
let uploadedImageData = "";
let uploadedUpdateImageData = "";

imageFileInput.addEventListener("change", handleImageUpload);
updateImageFileInput.addEventListener("change", handleUpdateImageUpload);
productForm.addEventListener("submit", handleSaveProduct);
productForm.addEventListener("reset", () => {
  uploadedImageData = "";
});
updateForm.addEventListener("submit", handleUpdateProduct);
updateProductSelect.addEventListener("change", populateUpdateForm);
setPinBtn.addEventListener("click", handleSetPin);
unlockBtn.addEventListener("click", handleUnlock);
lockBtn.addEventListener("click", lockCosts);
navCards.forEach((card) => {
  card.addEventListener("click", () => {
    switchView(card.dataset.view || "add");
  });
});

renderProducts();
renderUpdateOptions();
refreshPinStatus();
switchView("add");

function loadProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function currency(value) {
  if (value === "" || value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function dateLabel(value) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function discountedPrice(mrp, discount) {
  const mrpValue = Number(mrp);
  const discountValue = Number(discount);
  if (Number.isNaN(mrpValue)) {
    return null;
  }
  if (Number.isNaN(discountValue)) {
    return mrpValue;
  }
  return mrpValue - mrpValue * (discountValue / 100);
}

function handleImageUpload(event) {
  const [file] = event.target.files;
  if (!file) {
    uploadedImageData = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    uploadedImageData = String(reader.result || "");
  };
  reader.readAsDataURL(file);
}

function handleUpdateImageUpload(event) {
  const [file] = event.target.files;
  if (!file) {
    uploadedUpdateImageData = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    uploadedUpdateImageData = String(reader.result || "");
  };
  reader.readAsDataURL(file);
}

function handleSaveProduct(event) {
  event.preventDefault();

  const formData = new FormData(productForm);
  const product = {
    id: crypto.randomUUID(),
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    image: uploadedImageData || String(formData.get("imageUrl") || "").trim(),
    purchaseDate: String(formData.get("purchaseDate") || ""),
    saleDate: String(formData.get("saleDate") || ""),
    mrp: String(formData.get("mrp") || ""),
    discount: String(formData.get("discount") || ""),
    sellingPrice: String(formData.get("sellingPrice") || ""),
    purchasePrice: String(formData.get("purchasePrice") || ""),
    notes: String(formData.get("notes") || "").trim(),
  };

  if (!product.name) {
    return;
  }

  products.unshift(product);
  saveProducts();
  productForm.reset();
  uploadedImageData = "";
  renderProducts();
  renderUpdateOptions();
  switchView("inventory");
}

function handleUpdateProduct(event) {
  event.preventDefault();

  const selectedId = updateProductSelect.value;
  const index = products.findIndex((item) => item.id === selectedId);
  if (index === -1) {
    return;
  }

  const existing = products[index];
  const formData = new FormData(updateForm);
  products[index] = {
    ...existing,
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    image: uploadedUpdateImageData || String(formData.get("imageUrl") || "").trim() || existing.image,
    purchaseDate: String(formData.get("purchaseDate") || ""),
    saleDate: String(formData.get("saleDate") || ""),
    mrp: String(formData.get("mrp") || ""),
    discount: String(formData.get("discount") || ""),
    sellingPrice: String(formData.get("sellingPrice") || ""),
    purchasePrice: String(formData.get("purchasePrice") || ""),
    notes: String(formData.get("notes") || "").trim(),
  };

  saveProducts();
  renderProducts();
  renderUpdateOptions();
  switchView("inventory");
}

function renderProducts() {
  productGrid.innerHTML = "";
  emptyState.style.display = products.length ? "none" : "block";
  productCount.textContent = String(products.length);

  products.forEach((product) => {
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector(".product-card");
    const img = clone.querySelector(".product-image");
    const deleteBtn = clone.querySelector(".delete-btn");

    clone.querySelector(".product-name").textContent = product.name || "Untitled Product";
    clone.querySelector(".product-category").textContent = product.category || "Uncategorized";
    clone.querySelector('[data-field="purchaseDate"]').textContent = dateLabel(product.purchaseDate);
    clone.querySelector('[data-field="saleDate"]').textContent = dateLabel(product.saleDate);
    clone.querySelector('[data-field="mrp"]').textContent = currency(product.mrp);
    clone.querySelector('[data-field="discount"]').textContent = product.discount ? `${product.discount}%` : "-";
    clone.querySelector('[data-field="sellingPrice"]').textContent = currency(product.sellingPrice);
    clone.querySelector('[data-field="discountedPrice"]').textContent = currency(discountedPrice(product.mrp, product.discount));
    clone.querySelector('[data-field="purchasePrice"]').textContent = costsUnlocked
      ? currency(product.purchasePrice)
      : "PIN Required";

    const notesElement = clone.querySelector('[data-field="notes"]');
    notesElement.textContent = product.notes || "No notes added.";

    img.src = product.image || "https://placehold.co/600x400/f0dac4/6a4930?text=No+Image";
    img.alt = product.name || "Product image";

    deleteBtn.addEventListener("click", () => {
      products = products.filter((item) => item.id !== product.id);
      saveProducts();
      renderProducts();
      renderUpdateOptions();
    });

    productGrid.appendChild(card);
  });
}

function renderUpdateOptions() {
  updateProductSelect.innerHTML = "";

  if (!products.length) {
    updateEmptyState.style.display = "block";
    updateWorkspace.style.display = "none";
    return;
  }

  updateEmptyState.style.display = "none";
  updateWorkspace.style.display = "grid";

  products.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = product.name || "Untitled Product";
    updateProductSelect.appendChild(option);
  });

  populateUpdateForm();
}

function populateUpdateForm() {
  const product = products.find((item) => item.id === updateProductSelect.value) || products[0];
  if (!product) {
    return;
  }

  updateProductSelect.value = product.id;
  document.getElementById("updateName").value = product.name || "";
  document.getElementById("updateCategory").value = product.category || "";
  document.getElementById("updateImageUrl").value = product.image && !product.image.startsWith("data:") ? product.image : "";
  document.getElementById("updatePurchaseDate").value = product.purchaseDate || "";
  document.getElementById("updateSaleDate").value = product.saleDate || "";
  document.getElementById("updateMrp").value = product.mrp || "";
  document.getElementById("updateDiscount").value = product.discount || "";
  document.getElementById("updateSellingPrice").value = product.sellingPrice || "";
  document.getElementById("updatePurchasePrice").value = product.purchasePrice || "";
  document.getElementById("updateNotes").value = product.notes || "";
  updateImageFileInput.value = "";
  uploadedUpdateImageData = "";
}

function getSavedPin() {
  return localStorage.getItem(PIN_KEY) || "";
}

function handleSetPin() {
  const pin = pinInput.value.trim();
  if (pin.length < 4) {
    pinStatus.textContent = "Choose a PIN with at least 4 digits or characters.";
    return;
  }

  localStorage.setItem(PIN_KEY, pin);
  pinStatus.textContent = "PIN saved. Purchase prices are locked until unlocked.";
  costsUnlocked = false;
  pinInput.value = "";
  renderProducts();
}

function handleUnlock() {
  const savedPin = getSavedPin();
  if (!savedPin) {
    pinStatus.textContent = "Set a PIN first to protect purchase prices.";
    return;
  }

  if (pinInput.value.trim() !== savedPin) {
    costsUnlocked = false;
    pinStatus.textContent = "Incorrect PIN. Purchase prices remain hidden.";
    renderProducts();
    return;
  }

  costsUnlocked = true;
  pinStatus.textContent = "Purchase prices are visible for this session.";
  pinInput.value = "";
  renderProducts();
}

function lockCosts() {
  costsUnlocked = false;
  refreshPinStatus();
  renderProducts();
}

function refreshPinStatus() {
  pinStatus.textContent = costsUnlocked
    ? "Purchase prices are visible for this session."
    : "Purchase prices are locked.";
}

function switchView(viewName) {
  screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === viewName);
  });
}
