const STORAGE_KEY = "minha_estante_catalogo_v1";
const SHEETS_URL_KEY = "minha_estante_sheets_url_v1";
const ADMIN_KEY_STORAGE = "minha_estante_admin_key_v1";

const isAdmin = document.body.dataset.mode === "admin";
const urlParams = new URLSearchParams(window.location.search);
const paramSheetsUrl = urlParams.get("sheets") || "";

let books = loadBooks();
let sheetsUrl =
  paramSheetsUrl ||
  localStorage.getItem(SHEETS_URL_KEY) ||
  window.APP_CONFIG?.sheetsUrl ||
  "";
let adminKey = sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
let currentView = "grid"; // "grid" | "list"

// Elements
const catalogEl = document.getElementById("catalog-container");
const emptyStateEl = document.getElementById("empty-state");
const statsSummaryEl = document.getElementById("stats-summary");
const searchInput = document.getElementById("search-input");
const filterStatus = document.getElementById("filter-status");
const viewGridBtn = document.getElementById("view-grid");
const viewListBtn = document.getElementById("view-list");

// Modal elements
const modalEl = document.getElementById("book-modal");
const modalTitleEl = document.getElementById("modal-title");
const bookForm = document.getElementById("book-form");
const bookIdInput = document.getElementById("book-id");
const isbnInput = document.getElementById("book-isbn");
const isbnFeedback = document.getElementById("isbn-feedback");
const btnLookupIsbn = document.getElementById("btn-lookup-isbn");
const titleInput = document.getElementById("book-title");
const authorInput = document.getElementById("book-author");
const priceInput = document.getElementById("book-price");
const qtyInput = document.getElementById("book-qty");
const coverUrlInput = document.getElementById("book-cover-url");
const coverFileInput = document.getElementById("cover-file");
const coverImgEl = document.getElementById("cover-img");
const coverPlaceholderEl = document.getElementById("cover-placeholder");
const btnClearCover = document.getElementById("btn-clear-cover");
const btnScanIsbn = document.getElementById("btn-scan-isbn");
const isbnFileInput = document.getElementById("isbn-file");
const btnScanCover = document.getElementById("btn-scan-cover");
const cameraPanelEl = document.getElementById("camera-panel");
const cameraVideoEl = document.getElementById("camera-video");
const cameraHintEl = document.getElementById("camera-hint");
const btnCaptureCover = document.getElementById("btn-capture-cover");
const btnStopCamera = document.getElementById("btn-stop-camera");
const searchResultsEl = document.getElementById("search-results");

let cameraStream = null;
let scanLoopTimer = null;
let zxingReader = null;

// Storage
function loadBooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  if (sheetsUrl) {
    pushToSheets();
  }
}

function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeIsbn(raw) {
  return (raw || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// Rendering
function updateStats() {
  const totalTitles = books.length;
  const totalUnits = books.reduce((sum, b) => sum + Math.max(0, Number(b.qty) || 0), 0);
  statsSummaryEl.textContent = `${totalTitles} ${totalTitles === 1 ? "título" : "títulos"} · ${totalUnits} ${totalUnits === 1 ? "disponível" : "disponíveis"}`;
}

function getFilteredBooks() {
  const q = searchInput.value.trim().toLowerCase();
  const status = filterStatus.value;

  return books.filter((book) => {
    if (status === "available" && Number(book.qty) <= 0) return false;
    if (status === "sold" && Number(book.qty) > 0) return false;

    if (!q) return true;
    return (
      (book.title || "").toLowerCase().includes(q) ||
      (book.author || "").toLowerCase().includes(q) ||
      (book.isbn || "").toLowerCase().includes(q)
    );
  });
}

function renderCatalog() {
  updateStats();
  const list = getFilteredBooks();

  if (list.length === 0) {
    catalogEl.innerHTML = "";
    emptyStateEl.classList.remove("hidden");
    return;
  }

  emptyStateEl.classList.add("hidden");
  catalogEl.className = currentView === "grid" ? "catalog-grid" : "catalog-list";

  if (currentView === "grid") {
    catalogEl.innerHTML = list.map(renderCard).join("");
  } else {
    catalogEl.innerHTML = list.map(renderRow).join("");
  }
}

function renderCard(book) {
  const qty = Number(book.qty) || 0;
  const soldOutClass = qty <= 0 ? "is-sold-out" : "";
  const coverHtml = book.cover
    ? `<img src="${escapeHtml(book.cover)}" alt="Capa de ${escapeHtml(book.title)}" loading="lazy" />`
    : `<div class="no-cover-box">Sem capa</div>`;

  return `
    <article class="book-card ${soldOutClass}" data-id="${book.id}">
      <div class="book-cover-wrap">
        ${coverHtml}
        <span class="qty-badge ${qty <= 0 ? "zero" : ""}">
          ${qty > 0 ? `${qty} disp.` : "Esgotado"}
        </span>
      </div>
      <div class="book-info">
        <h3 class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3>
        <p class="book-author" title="${escapeHtml(book.author)}">${escapeHtml(book.author)}</p>
        <div class="book-price">${formatBRL(book.price)}</div>
      </div>
      ${
        isAdmin
          ? `<div class="book-actions">
        <button type="button" class="btn btn-sm btn-sold" data-action="sell" ${qty <= 0 ? "disabled" : ""}>
          -1 Vendido
        </button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="edit" title="Editar">
          Editar
        </button>
        <button type="button" class="btn btn-sm btn-danger-ghost" data-action="delete" title="Excluir livro">
          ✕
        </button>
      </div>`
          : ""
      }
    </article>
  `;
}

function renderRow(book) {
  const qty = Number(book.qty) || 0;
  const soldOutClass = qty <= 0 ? "is-sold-out" : "";
  const coverHtml = book.cover
    ? `<img src="${escapeHtml(book.cover)}" alt="Capa" loading="lazy" />`
    : `<span>Sem capa</span>`;

  return `
    <article class="book-row ${soldOutClass}" data-id="${book.id}">
      <div class="row-thumb">${coverHtml}</div>
      <div class="row-main">
        <h3 class="book-title">${escapeHtml(book.title)}</h3>
        <p class="book-author">${escapeHtml(book.author)}</p>
        ${book.isbn ? `<span class="row-isbn">ISBN: ${escapeHtml(book.isbn)}</span>` : ""}
      </div>
      <div class="row-price">${formatBRL(book.price)}</div>
      <div class="row-qty ${qty <= 0 ? "zero" : ""}">
        ${qty > 0 ? `${qty} disp.` : "Esgotado"}
      </div>
      ${
        isAdmin
          ? `<div class="row-actions">
        <button type="button" class="btn btn-sm btn-sold" data-action="sell" ${qty <= 0 ? "disabled" : ""}>
          -1 Vendido
        </button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="edit">
          Editar
        </button>
        <button type="button" class="btn btn-sm btn-danger-ghost" data-action="delete" title="Excluir">
          ✕
        </button>
      </div>`
          : ""
      }
    </article>
  `;
}

// Actions on catalog items (Admin only)
if (isAdmin) {
  catalogEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const itemEl = btn.closest("[data-id]");
  if (!itemEl) return;

  const id = itemEl.dataset.id;
  const book = books.find((b) => b.id === id);
  if (!book) return;

  const action = btn.dataset.action;

  if (action === "sell") {
    if (book.qty > 0) {
      book.qty -= 1;
      saveBooks();
      renderCatalog();
    }
  } else if (action === "edit") {
    openModal(book);
  } else if (action === "delete") {
    if (confirm(`Remover "${book.title}" do catálogo?`)) {
      books = books.filter((b) => b.id !== id);
      saveBooks();
      renderCatalog();
    }
  }
  });
}

// Modal handling
function setCoverPreview(src) {
  coverUrlInput.value = src || "";
  if (src) {
    coverImgEl.src = src;
    coverImgEl.classList.remove("hidden");
    coverPlaceholderEl.classList.add("hidden");
    btnClearCover.classList.remove("hidden");
  } else {
    coverImgEl.src = "";
    coverImgEl.classList.add("hidden");
    coverPlaceholderEl.classList.remove("hidden");
    btnClearCover.classList.add("hidden");
  }
}

function setIsbnFeedback(msg, type = "") {
  isbnFeedback.textContent = msg;
  isbnFeedback.className = `feedback-text ${type}`.trim();
}

function openModal(book = null) {
  bookForm.reset();
  setIsbnFeedback("");
  clearSearchResults();

  if (book) {
    modalTitleEl.textContent = "Editar Livro";
    bookIdInput.value = book.id;
    isbnInput.value = book.isbn || "";
    titleInput.value = book.title || "";
    authorInput.value = book.author || "";
    priceInput.value = book.price ?? "";
    qtyInput.value = book.qty ?? 1;
    setCoverPreview(book.cover || "");
  } else {
    modalTitleEl.textContent = "Adicionar Livro";
    bookIdInput.value = "";
    qtyInput.value = 1;
    setCoverPreview("");
  }

  modalEl.classList.remove("hidden");
  setTimeout(() => (book ? titleInput.focus() : isbnInput.focus()), 30);
}

function closeModal() {
  stopCamera();
  modalEl.classList.add("hidden");
}

if (isAdmin) {
  document.getElementById("btn-open-add").addEventListener("click", () => openModal());
  document.getElementById("btn-empty-add").addEventListener("click", () => openModal());
  document.getElementById("btn-close-modal").addEventListener("click", closeModal);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });

// Save book
bookForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const id = bookIdInput.value;
  const isbn = isLikelyIsbn(isbnInput.value) ? normalizeIsbn(isbnInput.value) : "";
  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  const price = parseFloat(priceInput.value) || 0;
  const qty = Math.max(0, parseInt(qtyInput.value, 10) || 0);
  const cover = coverUrlInput.value.trim();

  if (!title || !author) return;

  if (id) {
    const idx = books.findIndex((b) => b.id === id);
    if (idx !== -1) {
      books[idx] = { ...books[idx], isbn, title, author, price, qty, cover };
    }
  } else {
    books.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      isbn,
      title,
      author,
      price,
      qty,
      cover,
      createdAt: Date.now(),
    });
  }

  saveBooks();
  renderCatalog();
  closeModal();
});

// Shared image compression so localStorage and Google Sheets cells stay within limits
function compressSourceToDataUrl(source, width, height) {
  const maxW = 280;
  const scale = Math.min(1, maxW / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  let quality = 0.7;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 45000 && quality > 0.25) {
    quality -= 0.15;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  return dataUrl;
}

// Photo upload (cover)
coverFileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      setCoverPreview(compressSourceToDataUrl(img, img.width, img.height));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  coverFileInput.value = "";
});

btnClearCover.addEventListener("click", () => setCoverPreview(""));

// Barcode decoding helpers (native BarcodeDetector + ZXing fallback)
async function decodeBarcodeFromSource(source) {
  if ("BarcodeDetector" in window) {
    try {
      const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "code_128"] });
      const results = await detector.detect(source);
      if (results.length > 0 && results[0].rawValue) {
        return normalizeIsbn(results[0].rawValue);
      }
    } catch {
      // Fall through to ZXing
    }
  }
  return "";
}

function getZxingReader() {
  if (!zxingReader && window.ZXing?.BrowserMultiFormatReader) {
    zxingReader = new window.ZXing.BrowserMultiFormatReader();
  }
  return zxingReader;
}

// Import photo of ISBN barcode
isbnFileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setIsbnFeedback("Lendo código de barras da imagem...");
  const url = URL.createObjectURL(file);

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    let code = await decodeBarcodeFromSource(img);
    if (!code) {
      const reader = getZxingReader();
      if (reader) {
        try {
          const result = await reader.decodeFromImageElement(img);
          code = normalizeIsbn(result?.getText?.() || "");
        } catch {
          code = "";
        }
      }
    }

    if (code && code.length >= 10) {
      isbnInput.value = code;
      await lookupByIsbn();
    } else {
      setIsbnFeedback("Não foi possível ler o código ISBN na foto. Tente aproximar mais.", "error");
    }
  } catch {
    setIsbnFeedback("Erro ao processar a imagem do código.", "error");
  } finally {
    URL.revokeObjectURL(url);
    isbnFileInput.value = "";
  }
});

// Live camera for ISBN scanning or Cover photo capture
function stopCamera() {
  if (scanLoopTimer) {
    clearTimeout(scanLoopTimer);
    scanLoopTimer = null;
  }
  if (zxingReader) {
    try {
      zxingReader.reset();
    } catch {
      // Ignore
    }
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  cameraVideoEl.srcObject = null;
  cameraPanelEl.classList.add("hidden");
  btnCaptureCover.classList.add("hidden");
}

async function startCamera(mode) {
  stopCamera();

  if (!navigator.mediaDevices?.getUserMedia) {
    setIsbnFeedback(
      "Câmera ao vivo indisponível aqui (abra via localhost ou use 'Importar Foto').",
      "error"
    );
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    cameraVideoEl.srcObject = cameraStream;
    cameraPanelEl.classList.remove("hidden");

    if (mode === "cover") {
      cameraHintEl.textContent = "Enquadre a capa do livro e clique em Capturar Capa.";
      btnCaptureCover.classList.remove("hidden");
    } else {
      cameraHintEl.textContent = "Aponte a câmera para o código de barras ISBN...";
      btnCaptureCover.classList.add("hidden");
      startIsbnScanLoop();
    }
  } catch {
    setIsbnFeedback(
      "Não foi possível acessar a câmera. Verifique a permissão ou use 'Importar Foto'.",
      "error"
    );
  }
}

function startIsbnScanLoop() {
  const reader = !("BarcodeDetector" in window) ? getZxingReader() : null;

  if (reader) {
    reader.decodeFromVideoElement(cameraVideoEl, (result) => {
      if (!cameraStream) return;
      const code = normalizeIsbn(result?.getText?.() || "");
      if (code.length >= 10) {
        isbnInput.value = code;
        stopCamera();
        lookupByIsbn();
      }
    });
    return;
  }

  const tick = async () => {
    if (!cameraStream) return;
    if (cameraVideoEl.readyState >= 2) {
      const code = await decodeBarcodeFromSource(cameraVideoEl);
      if (code.length >= 10) {
        isbnInput.value = code;
        stopCamera();
        lookupByIsbn();
        return;
      }
    }
    scanLoopTimer = setTimeout(tick, 250);
  };
  scanLoopTimer = setTimeout(tick, 300);
}

btnScanIsbn.addEventListener("click", () => startCamera("isbn"));
btnScanCover.addEventListener("click", () => startCamera("cover"));
btnStopCamera.addEventListener("click", stopCamera);

btnCaptureCover.addEventListener("click", () => {
  if (!cameraVideoEl.videoWidth || !cameraVideoEl.videoHeight) return;
  const dataUrl = compressSourceToDataUrl(
    cameraVideoEl,
    cameraVideoEl.videoWidth,
    cameraVideoEl.videoHeight
  );
  setCoverPreview(dataUrl);
  stopCamera();
});

function clearSearchResults() {
  searchResultsEl.innerHTML = "";
  searchResultsEl.classList.add("hidden");
}

function isLikelyIsbn(raw) {
  const trimmed = (raw || "").trim();
  if (!/^[0-9Xx\s-]+$/.test(trimmed)) return false;
  const norm = normalizeIsbn(trimmed);
  return norm.length === 10 || norm.length === 13;
}

// Unified Lookup: ISBN or Title/Author (Google Books + Open Library fallback)
async function lookupByIsbn() {
  const rawQuery = isbnInput.value.trim();
  if (!rawQuery) {
    setIsbnFeedback("Digite um ISBN, título ou autor para buscar.", "error");
    return;
  }

  clearSearchResults();
  btnLookupIsbn.disabled = true;

  if (isLikelyIsbn(rawQuery)) {
    const isbn = normalizeIsbn(rawQuery);
    setIsbnFeedback("Buscando informações e capa pelo ISBN...");

    try {
      let found = await fetchGoogleBooks(isbn);
      if (!found || !found.cover) {
        const ol = await fetchOpenLibrary(isbn);
        if (ol) {
          found = {
            title: found?.title || ol.title,
            author: found?.author || ol.author,
            cover: found?.cover || ol.cover,
          };
        }
      }

      if (found) {
        applyLookupSelection({ ...found, isbn });
      } else {
        setIsbnFeedback("ISBN não encontrado. Preencha manualmente ou envie uma foto.", "error");
      }
    } catch {
      setIsbnFeedback("Erro ao consultar a internet. Preencha manualmente.", "error");
    } finally {
      btnLookupIsbn.disabled = false;
    }
    return;
  }

  // Title or Author search
  setIsbnFeedback("Buscando livros por título ou autor...");
  try {
    let results = await searchGoogleBooksByText(rawQuery);
    if (results.length === 0) {
      results = await searchOpenLibraryByText(rawQuery);
    }

    if (results.length > 0) {
      setIsbnFeedback(`Encontramos ${results.length} resultado(s). Selecione um livro abaixo:`, "success");
      renderSearchResults(results);
    } else {
      setIsbnFeedback("Nenhum livro encontrado. Preencha manualmente ou envie uma foto.", "error");
    }
  } catch {
    setIsbnFeedback("Erro ao consultar a internet. Preencha manualmente.", "error");
  } finally {
    btnLookupIsbn.disabled = false;
  }
}

function applyLookupSelection(item) {
  isbnInput.value = item.isbn || "";
  if (item.title) titleInput.value = item.title;
  if (item.author) authorInput.value = item.author;
  if (item.cover) setCoverPreview(item.cover);

  const existing = item.isbn
    ? books.find((b) => b.isbn === item.isbn && b.id !== bookIdInput.value)
    : null;
  const dupNote = existing ? " (Obs: este ISBN já está no catálogo.)" : "";
  setIsbnFeedback(`Livro selecionado! Confira os dados e informe o valor.${dupNote}`, "success");
  clearSearchResults();
  priceInput.focus();
}

function renderSearchResults(results) {
  searchResultsEl.innerHTML = "";
  results.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-result-item";

    const thumbHtml = item.cover
      ? `<img class="search-result-thumb" src="${escapeHtml(item.cover)}" alt="" />`
      : `<div class="search-result-thumb"></div>`;

    const metaParts = [item.author || "Autor desconhecido"];
    if (item.isbn) metaParts.push(`ISBN: ${item.isbn}`);

    btn.innerHTML = `
      ${thumbHtml}
      <div class="search-result-info">
        <div class="search-result-title">${escapeHtml(item.title)}</div>
        <div class="search-result-meta">${escapeHtml(metaParts.join(" · "))}</div>
      </div>
    `;
    btn.addEventListener("click", () => applyLookupSelection(item));
    searchResultsEl.appendChild(btn);
  });
  searchResultsEl.classList.remove("hidden");
}

function extractIsbnFromGoogleVolume(info) {
  const ids = info.industryIdentifiers || [];
  const isbn13 = ids.find((i) => i.type === "ISBN_13")?.identifier;
  const isbn10 = ids.find((i) => i.type === "ISBN_10")?.identifier;
  return normalizeIsbn(isbn13 || isbn10 || "");
}

async function searchGoogleBooksByText(query) {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=6`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((entry) => {
    const info = entry.volumeInfo || {};
    let cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";
    if (cover.startsWith("http://")) cover = cover.replace("http://", "https://");
    const isbn = extractIsbnFromGoogleVolume(info);
    if (!cover && isbn) {
      cover = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`;
    }
    return {
      title: info.title || "",
      author: Array.isArray(info.authors) ? info.authors.join(", ") : "",
      isbn,
      cover,
    };
  }).filter((b) => b.title);
}

async function searchOpenLibraryByText(query) {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=6`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.docs || []).map((doc) => {
    const isbn = normalizeIsbn(Array.isArray(doc.isbn) ? doc.isbn[0] : "");
    const cover = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : isbn
        ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`
        : "";
    return {
      title: doc.title || "",
      author: Array.isArray(doc.author_name) ? doc.author_name.join(", ") : "",
      isbn,
      cover,
    };
  }).filter((b) => b.title);
}

async function fetchGoogleBooks(isbn) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const info = data.items?.[0]?.volumeInfo;
  if (!info) return null;

  let cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";
  if (cover.startsWith("http://")) cover = cover.replace("http://", "https://");

  return {
    title: info.title || "",
    author: Array.isArray(info.authors) ? info.authors.join(", ") : "",
    cover,
  };
}

async function fetchOpenLibrary(isbn) {
  const res = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const entry = data[`ISBN:${isbn}`];
  if (!entry) return null;

  const cover =
    entry.cover?.large ||
    entry.cover?.medium ||
    `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;

  return {
    title: entry.title || "",
    author: Array.isArray(entry.authors) ? entry.authors.map((a) => a.name).join(", ") : "",
    cover,
  };
}

  btnLookupIsbn.addEventListener("click", lookupByIsbn);
  isbnInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupByIsbn();
    }
  });
}

// Filters & View Toggle
searchInput.addEventListener("input", renderCatalog);
filterStatus.addEventListener("change", renderCatalog);

viewGridBtn.addEventListener("click", () => {
  currentView = "grid";
  viewGridBtn.classList.add("active");
  viewListBtn.classList.remove("active");
  renderCatalog();
});

viewListBtn.addEventListener("click", () => {
  currentView = "list";
  viewListBtn.classList.add("active");
  viewGridBtn.classList.remove("active");
  renderCatalog();
});

// Google Sheets Sync
const syncStatusTextEl = document.getElementById("sync-status-text");
const publicSyncBadgeEl = document.getElementById("public-sync-badge");
const syncModalEl = document.getElementById("sync-modal");
const syncFormEl = document.getElementById("sync-form");
const sheetsUrlInput = document.getElementById("sheets-url");
const syncFeedbackEl = document.getElementById("sync-feedback");
const btnDisconnectSync = document.getElementById("btn-disconnect-sync");
const btnPullSync = document.getElementById("btn-pull-sync");

function setSyncStatus(label) {
  if (syncStatusTextEl) syncStatusTextEl.textContent = `☁️ ${label}`;
}

function setSyncFeedback(msg, type = "") {
  if (!syncFeedbackEl) return;
  syncFeedbackEl.textContent = msg;
  syncFeedbackEl.className = `feedback-text ${type}`.trim();
}

async function pushToSheets() {
  if (!sheetsUrl || !isAdmin) return false;
  setSyncStatus("Salvando...");
  try {
    const res = await fetch(sheetsUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ adminKey, books }),
    });
    const data = await res.json();
    if (data?.ok) {
      setSyncStatus("Sincronizado");
      return true;
    }
    if (data?.error) {
      setSyncStatus("Senha inválida");
      return false;
    }
  } catch {
    // Handled below
  }
  setSyncStatus("Erro na nuvem");
  return false;
}

async function pullFromSheets({ pushIfEmpty = false } = {}) {
  if (!sheetsUrl) return false;
  setSyncStatus("Carregando...");
  try {
    const res = await fetch(sheetsUrl);
    const data = await res.json();
    if (data?.ok && Array.isArray(data.books)) {
      if (isAdmin && data.books.length === 0 && pushIfEmpty && books.length > 0) {
        await pushToSheets();
        return true;
      }
      books = data.books;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
      renderCatalog();
      setSyncStatus("Sincronizado");
      if (publicSyncBadgeEl) publicSyncBadgeEl.textContent = "Catálogo atualizado";
      return true;
    }
  } catch {
    // Handled below
  }
  setSyncStatus("Erro na nuvem");
  return false;
}

if (isAdmin) {
  // Export / Import JSON
  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(books, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catalogo-livros-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("import-input").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed)) {
          books = parsed;
          saveBooks();
          renderCatalog();
        } else {
          alert("Arquivo inválido.");
        }
      } catch {
        alert("Não foi possível ler o arquivo JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  function openSyncModal() {
    sheetsUrlInput.value = sheetsUrl;
    setSyncFeedback("");
    btnDisconnectSync.classList.toggle("hidden", !sheetsUrl);
    btnPullSync.classList.toggle("hidden", !sheetsUrl);
    syncModalEl.classList.remove("hidden");
  }

  function closeSyncModal() {
    syncModalEl.classList.add("hidden");
  }

  document.getElementById("btn-open-sync").addEventListener("click", openSyncModal);
  document.getElementById("btn-close-sync").addEventListener("click", closeSyncModal);
  syncModalEl.addEventListener("click", (e) => {
    if (e.target === syncModalEl) closeSyncModal();
  });

  syncFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = sheetsUrlInput.value.trim();
    if (!url) {
      setSyncFeedback("Cole a URL do Google Apps Script.", "error");
      return;
    }

    sheetsUrl = url;
    localStorage.setItem(SHEETS_URL_KEY, sheetsUrl);
    setSyncFeedback("Conectando à planilha...");

    const ok = await pullFromSheets({ pushIfEmpty: true });
    if (ok) {
      setSyncFeedback("Conectado e sincronizado com sucesso!", "success");
      btnDisconnectSync.classList.remove("hidden");
      btnPullSync.classList.remove("hidden");
    } else {
      setSyncFeedback("Não foi possível conectar. Verifique a URL e as permissões.", "error");
    }
  });

  btnPullSync.addEventListener("click", async () => {
    setSyncFeedback("Recarregando dados da planilha...");
    const ok = await pullFromSheets();
    setSyncFeedback(
      ok ? "Catálogo atualizado a partir da planilha!" : "Erro ao carregar da planilha.",
      ok ? "success" : "error"
    );
  });

  btnDisconnectSync.addEventListener("click", () => {
    sheetsUrl = "";
    localStorage.removeItem(SHEETS_URL_KEY);
    sheetsUrlInput.value = "";
    setSyncStatus("Local");
    btnDisconnectSync.classList.add("hidden");
    btnPullSync.classList.add("hidden");
    setSyncFeedback("Desconectado. Os dados continuam salvos localmente.", "success");
  });

  // Admin Login Gate
  const adminGateEl = document.getElementById("admin-gate");
  const adminAppEl = document.getElementById("admin-app");
  const adminLoginForm = document.getElementById("admin-login-form");
  const adminPasswordInput = document.getElementById("admin-password");
  const adminLoginFeedback = document.getElementById("admin-login-feedback");
  const btnAdminLogin = document.getElementById("btn-admin-login");

  function unlockAdminApp() {
    adminGateEl.classList.add("hidden");
    adminAppEl.classList.remove("hidden");
    renderCatalog();
    if (sheetsUrl) {
      pullFromSheets({ pushIfEmpty: true });
    } else {
      setSyncStatus("Local");
    }
  }

  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pwd = adminPasswordInput.value;
    if (!pwd) return;

    if (!sheetsUrl) {
      adminKey = pwd;
      sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
      unlockAdminApp();
      return;
    }

    btnAdminLogin.disabled = true;
    adminLoginFeedback.textContent = "Verificando senha...";
    adminLoginFeedback.className = "feedback-text";

    try {
      const res = await fetch(sheetsUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "verify", adminKey: pwd }),
      });
      const data = await res.json();
      if (data?.ok) {
        adminKey = pwd;
        sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
        unlockAdminApp();
      } else {
        adminLoginFeedback.textContent = data?.error || "Senha incorreta.";
        adminLoginFeedback.className = "feedback-text error";
      }
    } catch {
      adminLoginFeedback.textContent = "Erro ao validar na planilha. Verifique a conexão.";
      adminLoginFeedback.className = "feedback-text error";
    } finally {
      btnAdminLogin.disabled = false;
    }
  });

  if (adminKey) {
    unlockAdminApp();
  }
} else {
  // Public view (read-only)
  renderCatalog();
  if (sheetsUrl) {
    pullFromSheets();
  }
}
