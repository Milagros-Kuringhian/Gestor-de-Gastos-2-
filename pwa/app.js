const STORAGE_KEY = "mi-plata-v1";

const CATEGORIAS = [
  { id: "cobre", nombre: "Cobré", tipo: "ingreso", tag: "Ingreso" },
  { id: "padel", nombre: "Pádel", tipo: "gasto", tag: "Gasto" },
  { id: "facultad", nombre: "Facultad", tipo: "gasto", tag: "Gasto" },
  { id: "transporte", nombre: "Transporte", tipo: "gasto", tag: "Gasto" },
  { id: "hormiga", nombre: "Gastos hormiga", tipo: "gasto", tag: "Gasto" },
  { id: "otros", nombre: "Otros", tipo: "gasto", tag: "Gasto" },
  { id: "ahorre", nombre: "Ahorré", tipo: "aporte", tag: "Ahorro" },
  { id: "retire", nombre: "Retiré", tipo: "retiro", tag: "Ahorro" },
];

const $ = (sel) => document.querySelector(sel);

const els = {
  fechaHoy: $("#fecha-hoy"),
  plata: $("#plata-disponible"),
  cobrado: $("#total-cobrado"),
  gastado: $("#total-gastado"),
  ahorrado: $("#total-ahorrado"),
  grid: $("#cat-grid"),
  lista: $("#lista-movimientos"),
  empty: $("#empty-state"),
  modalMonto: $("#modal-monto"),
  modalSheetMonto: $("#modal-monto .modal-sheet"),
  modalTitulo: $("#modal-titulo"),
  modalSub: $("#modal-sub"),
  inputNombreOtros: $("#input-nombre-otros"),
  inputMonto: $("#input-monto"),
  btnGuardar: $("#btn-guardar"),
  modalAjustes: $("#modal-ajustes"),
  inputSaldo: $("#input-saldo"),
  inputSaldoAhorro: $("#input-saldo-ahorro"),
  btnAjustes: $("#btn-ajustes"),
  btnGuardarSaldo: $("#btn-guardar-saldo"),
  btnExportar: $("#btn-exportar"),
  installHint: $("#install-hint"),
  toast: $("#toast"),
};

let state = loadState();
let categoriaActiva = null;

function defaultState() {
  return {
    saldoInicial: 0,
    saldoAhorroInicial: 0,
    movimientos: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      saldoInicial: Number(parsed.saldoInicial) || 0,
      saldoAhorroInicial: Number(parsed.saldoAhorroInicial) || 0,
      movimientos: Array.isArray(parsed.movimientos) ? parsed.movimientos : [],
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatARS(n) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function hoyLabel() {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function hoyISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function totales() {
  let cobrado = 0;
  let gastado = 0;
  let aportes = 0;
  let retiros = 0;

  for (const mov of state.movimientos) {
    switch (mov.tipo) {
      case "ingreso":
        cobrado += mov.monto;
        break;
      case "gasto":
        gastado += mov.monto;
        break;
      case "aporte":
        aportes += mov.monto;
        break;
      case "retiro":
        retiros += mov.monto;
        break;
      default:
        // Movimientos viejos sin tipo conocido: tratar como gasto.
        gastado += mov.monto;
        break;
    }
  }

  return {
    cobrado,
    gastado,
    aportes,
    retiros,
    ahorrado: state.saldoAhorroInicial + aportes - retiros,
    disponible:
      state.saldoInicial + cobrado - gastado - aportes + retiros,
  };
}

function textoModalPorTipo(tipo) {
  switch (tipo) {
    case "ingreso":
      return "¿Cuánto cobraste hoy?";
    case "gasto":
      return "¿Cuánto gastaste?";
    case "aporte":
      return "¿Cuánto pasás a ahorro?";
    case "retiro":
      return "¿Cuánto sacás del ahorro?";
    default:
      return "¿Cuánto?";
  }
}

function toastPorTipo(tipo) {
  switch (tipo) {
    case "ingreso":
      return "Cobro anotado";
    case "gasto":
      return "Gasto anotado";
    case "aporte":
      return "Ahorro anotado";
    case "retiro":
      return "Retiro anotado";
    default:
      return "Anotado";
  }
}

function signoPorTipo(tipo) {
  switch (tipo) {
    case "ingreso":
    case "retiro":
      return "+";
    case "gasto":
    case "aporte":
      return "−";
    default:
      return "−";
  }
}

function renderCategorias() {
  els.grid.innerHTML = CATEGORIAS.map(
    (cat) => `
    <button type="button" class="cat-btn ${cat.tipo}" data-id="${cat.id}">
      <span class="tag">${cat.tag}</span>
      <span class="name">${cat.nombre}</span>
    </button>`
  ).join("");
}

function render() {
  els.fechaHoy.textContent = hoyLabel();
  const t = totales();
  els.plata.textContent = formatARS(t.disponible);
  els.cobrado.textContent = formatARS(t.cobrado);
  els.gastado.textContent = formatARS(t.gastado);
  els.ahorrado.textContent = formatARS(t.ahorrado);

  const ordenados = [...state.movimientos].sort((a, b) =>
    a.fechaISO < b.fechaISO ? 1 : a.fechaISO > b.fechaISO ? -1 : b.createdAt - a.createdAt
  );

  els.lista.innerHTML = ordenados
    .slice(0, 40)
    .map((mov) => {
      const signo = signoPorTipo(mov.tipo);
      return `
      <li>
        <div class="meta">
          <strong>${mov.nombre}</strong>
          <span>${formatFechaCorta(mov.fechaISO)}</span>
        </div>
        <div class="monto ${mov.tipo}">${signo}${formatARS(mov.monto)}</div>
        <button type="button" class="btn-borrar" data-del="${mov.id}" aria-label="Borrar">
          Borrar
        </button>
      </li>`;
    })
    .join("");

  els.empty.hidden = ordenados.length > 0;
}

function formatFechaCorta(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function abrirModalMonto(cat) {
  categoriaActiva = cat;
  els.modalSub.textContent = textoModalPorTipo(cat.tipo);
  els.inputMonto.value = "";
  const esOtros = cat.id === "otros";
  els.modalTitulo.hidden = esOtros;
  els.inputNombreOtros.hidden = !esOtros;
  if (esOtros) {
    els.inputNombreOtros.value = "";
    els.modalSheetMonto.setAttribute("aria-labelledby", "input-nombre-otros");
  } else {
    els.modalTitulo.textContent = cat.nombre;
    els.modalSheetMonto.setAttribute("aria-labelledby", "modal-titulo");
  }
  els.modalMonto.hidden = false;
  setTimeout(() => {
    if (esOtros) els.inputNombreOtros.focus();
    else els.inputMonto.focus();
  }, 50);
}

function cerrarModales() {
  els.modalMonto.hidden = true;
  els.modalAjustes.hidden = true;
  els.inputNombreOtros.value = "";
  els.inputNombreOtros.hidden = true;
  els.modalTitulo.hidden = false;
  els.modalSheetMonto.setAttribute("aria-labelledby", "modal-titulo");
  categoriaActiva = null;
}

function guardarMovimiento() {
  if (!categoriaActiva) return;
  const monto = Number(String(els.inputMonto.value).replace(",", "."));
  if (!Number.isFinite(monto) || monto <= 0) {
    showToast("Poné un monto válido");
    els.inputMonto.focus();
    return;
  }

  const tipo = categoriaActiva.tipo;
  const nombre =
    categoriaActiva.id === "otros"
      ? els.inputNombreOtros.value.trim() || "Otros"
      : categoriaActiva.nombre;
  state.movimientos.push({
    id:
      (crypto.randomUUID && crypto.randomUUID()) ||
      `m-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    categoriaId: categoriaActiva.id,
    nombre,
    tipo,
    monto,
    fechaISO: hoyISO(),
    createdAt: Date.now(),
  });
  saveState();
  cerrarModales();
  render();
  showToast(toastPorTipo(tipo));
}

function borrarMovimiento(id) {
  state.movimientos = state.movimientos.filter((m) => m.id !== id);
  saveState();
  render();
  showToast("Borrado");
}

function exportarCSV() {
  const header = "fecha,tipo,categoria,monto\n";
  const rows = state.movimientos
    .map(
      (m) =>
        `${m.fechaISO},${m.tipo},${escapeCsv(m.nombre)},${m.monto}`
    )
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mi-plata-${hoyISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV descargado");
}

function escapeCsv(value) {
  if (value.includes(",") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

let toastTimer;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 1800);
}

function wireEvents() {
  els.grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    const cat = CATEGORIAS.find((c) => c.id === btn.dataset.id);
    if (cat) abrirModalMonto(cat);
  });

  els.btnGuardar.addEventListener("click", guardarMovimiento);
  els.inputNombreOtros.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.inputMonto.focus();
    }
  });
  els.inputMonto.addEventListener("keydown", (e) => {
    if (e.key === "Enter") guardarMovimiento();
  });

  els.lista.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    borrarMovimiento(btn.dataset.del);
  });

  els.btnAjustes.addEventListener("click", () => {
    els.inputSaldo.value = state.saldoInicial || "";
    els.inputSaldoAhorro.value = state.saldoAhorroInicial || "";
    els.modalAjustes.hidden = false;
    setTimeout(() => els.inputSaldo.focus(), 50);
  });

  els.btnGuardarSaldo.addEventListener("click", () => {
    const saldo = Number(String(els.inputSaldo.value).replace(",", "."));
    const saldoAhorro = Number(
      String(els.inputSaldoAhorro.value).replace(",", ".")
    );
    if (!Number.isFinite(saldo) || saldo < 0) {
      showToast("Saldo inválido");
      return;
    }
    if (!Number.isFinite(saldoAhorro) || saldoAhorro < 0) {
      showToast("Ahorro inicial inválido");
      return;
    }
    state.saldoInicial = saldo;
    state.saldoAhorroInicial = saldoAhorro;
    saveState();
    cerrarModales();
    render();
    showToast("Saldos guardados");
  });

  els.btnExportar.addEventListener("click", exportarCSV);

  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", cerrarModales);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModales();
  });
}

function setupInstallHint() {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (!isStandalone) {
    els.installHint.hidden = false;
  }
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* ignore in file:// */
    });
  });
}

renderCategorias();
wireEvents();
render();
setupInstallHint();
registerSW();
