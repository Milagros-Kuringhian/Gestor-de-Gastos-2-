const S = MiPlataState;

const $ = (sel) => document.querySelector(sel);

const els = {
  fechaHoy: $("#fecha-hoy"),
  plata: $("#plata-disponible"),
  cobrado: $("#total-cobrado"),
  gastado: $("#total-gastado"),
  ahorrado: $("#total-ahorrado"),
  ahorroTotalWrap: $("#ahorro-total-wrap"),
  grid: $("#cat-grid"),
  lista: $("#lista-movimientos"),
  empty: $("#empty-state"),

  modalMonto: $("#modal-monto"),
  modalTitulo: $("#modal-titulo"),
  modalSub: $("#modal-sub"),
  inputMonto: $("#input-monto"),
  inputNota: $("#input-nota"),
  btnGuardar: $("#btn-guardar"),

  modalCrearCard: $("#modal-crear-card"),
  selectTipoCard: $("#select-tipo-card"),
  inputNombreCard: $("#input-nombre-card"),
  btnGuardarCard: $("#btn-guardar-card"),

  modalEditarMonto: $("#modal-editar-monto"),
  editarMontoSub: $("#editar-monto-sub"),
  inputEditarMonto: $("#input-editar-monto"),
  btnGuardarEditarMonto: $("#btn-guardar-editar-monto"),

  modalAjustes: $("#modal-ajustes"),
  inputSaldo: $("#input-saldo"),
  toggleAhorro: $("#toggle-ahorro"),
  bloqueSaldoAhorro: $("#bloque-saldo-ahorro"),
  inputSaldoAhorro: $("#input-saldo-ahorro"),
  listaCardsAjustes: $("#lista-cards-ajustes"),
  btnAjustes: $("#btn-ajustes"),
  btnGuardarSaldo: $("#btn-guardar-saldo"),
  btnAgregarCardAjustes: $("#btn-agregar-card-ajustes"),

  installHint: $("#install-hint"),
  toast: $("#toast"),
};

let state = loadState();
let cardActiva = null;
let movEditandoId = null;

function loadState() {
  try {
    const rawV2 = localStorage.getItem(S.STORAGE_KEY_V2);
    if (rawV2) {
      let loaded = S.normalizeState(JSON.parse(rawV2));
      if (loaded.ahorroActivo) loaded = S.ensureAhorroCards(loaded);
      return loaded;
    }
    const rawV1 = localStorage.getItem(S.STORAGE_KEY_V1);
    if (rawV1) {
      let migrated;
      try {
        migrated = S.normalizeState(S.migrateV1ToV2(JSON.parse(rawV1)));
      } catch {
        // Migración a medias: no tocamos v1 ni escribimos v2, arrancamos limpio.
        return S.defaultState();
      }
      if (migrated.ahorroActivo) migrated = S.ensureAhorroCards(migrated);
      localStorage.setItem(S.STORAGE_KEY_V2, JSON.stringify(migrated));
      localStorage.removeItem(S.STORAGE_KEY_V1);
      return migrated;
    }
  } catch {
    /* fallthrough */
  }
  return S.defaultState();
}

function saveState() {
  localStorage.setItem(S.STORAGE_KEY_V2, JSON.stringify(state));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function formatFechaCorta(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
  }).format(date);
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
  const cards = S.visibleCards(state);
  const btns = cards
    .map((cat) => {
      return `
    <button type="button" class="cat-btn ${cat.tipo}" data-id="${cat.id}">
      <span class="tag">${S.tagPorTipo(cat.tipo)}</span>
      <span class="name">${escapeHtml(cat.nombre)}</span>
    </button>`;
    })
    .join("");
  const add = `
    <button type="button" class="cat-btn add-card" id="btn-agregar-card">
      <span class="tag">Nueva</span>
      <span class="name">Agregar</span>
    </button>`;
  els.grid.innerHTML = btns + add;
}

function render() {
  els.fechaHoy.textContent = hoyLabel();
  const t = S.totales(state);
  els.plata.textContent = formatARS(t.disponible);
  els.cobrado.textContent = formatARS(t.cobrado);
  els.gastado.textContent = formatARS(t.gastado);
  els.ahorrado.textContent = formatARS(t.ahorrado);
  els.ahorroTotalWrap.hidden = !state.ahorroActivo;

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
          <strong>${escapeHtml(mov.nombre)}</strong>
          ${mov.nota ? `<span class="nota">${escapeHtml(mov.nota)}</span>` : ""}
          <span>${formatFechaCorta(mov.fechaISO)}</span>
        </div>
        <div class="monto ${mov.tipo}">${signo}${formatARS(mov.monto)}</div>
        <div class="acciones">
          <button type="button" class="btn-editar" data-edit="${mov.id}">Editar</button>
          <button type="button" class="btn-borrar" data-del="${mov.id}" aria-label="Borrar">
            Borrar
          </button>
        </div>
      </li>`;
    })
    .join("");

  els.empty.hidden = ordenados.length > 0;
}

function refrescar() {
  renderCategorias();
  render();
}

function abrirModalMonto(card) {
  cardActiva = card;
  els.modalTitulo.textContent = card.nombre;
  els.modalSub.textContent = textoModalPorTipo(card.tipo);
  els.inputMonto.value = "";
  els.inputNota.value = "";
  els.modalMonto.hidden = false;
  setTimeout(() => els.inputMonto.focus(), 50);
}

function abrirModalCrearCard() {
  poblarSelectTipoCard();
  els.inputNombreCard.value = "";
  els.modalCrearCard.hidden = false;
  setTimeout(() => els.inputNombreCard.focus(), 50);
}

function poblarSelectTipoCard() {
  const opciones = state.ahorroActivo
    ? [
        ["ingreso", "Ingreso"],
        ["gasto", "Egreso"],
        ["aporte", "Aporte a ahorro"],
        ["retiro", "Retiro de ahorro"],
      ]
    : [
        ["ingreso", "Ingreso"],
        ["gasto", "Egreso"],
      ];
  els.selectTipoCard.innerHTML = opciones
    .map(([valor, etiqueta]) => `<option value="${valor}">${etiqueta}</option>`)
    .join("");
}

function abrirModalEditarMonto(mov) {
  movEditandoId = mov.id;
  els.editarMontoSub.textContent = mov.nota ? `${mov.nombre} — ${mov.nota}` : mov.nombre;
  els.inputEditarMonto.value = mov.monto;
  els.modalEditarMonto.hidden = false;
  setTimeout(() => els.inputEditarMonto.focus(), 50);
}

function abrirModalAjustes() {
  els.inputSaldo.value = state.saldoInicial || "";
  els.inputSaldoAhorro.value = state.saldoAhorroInicial || "";
  els.toggleAhorro.checked = state.ahorroActivo;
  els.bloqueSaldoAhorro.hidden = !state.ahorroActivo;
  renderListaCardsAjustes();
  els.modalAjustes.hidden = false;
  setTimeout(() => els.inputSaldo.focus(), 50);
}

function renderListaCardsAjustes() {
  els.listaCardsAjustes.innerHTML = state.cards
    .map((card) => {
      const oculta =
        !state.ahorroActivo && (card.tipo === "aporte" || card.tipo === "retiro");
      const hint = oculta ? `<span class="hint-oculta">ocultas en inicio</span>` : "";
      return `
    <li>
      <div class="ajuste-card-info">
        <span class="tag-mini">${S.tagPorTipo(card.tipo)}</span>
        <input type="text" value="${escapeHtml(card.nombre)}" maxlength="40" data-rename="${card.id}" aria-label="Nombre" />
        ${hint}
      </div>
      <button type="button" class="btn-secondary" data-guardar-nombre="${card.id}">Guardar</button>
      <button type="button" class="btn-borrar" data-borrar-card="${card.id}" ${card.obligatoria ? "disabled" : ""}>Borrar</button>
    </li>`;
    })
    .join("");
}

function cerrarModales() {
  if (!els.modalCrearCard.hidden && !els.modalAjustes.hidden) {
    els.modalCrearCard.hidden = true;
    return;
  }
  els.modalMonto.hidden = true;
  els.modalCrearCard.hidden = true;
  els.modalEditarMonto.hidden = true;
  els.modalAjustes.hidden = true;
  cardActiva = null;
  movEditandoId = null;
}

function guardarMovimiento() {
  if (!cardActiva) return;
  const resultado = S.agregarMovimiento(state, {
    cardId: cardActiva.id,
    monto: els.inputMonto.value,
    nota: els.inputNota.value,
  });
  if (!resultado.ok) {
    showToast(resultado.error);
    els.inputMonto.focus();
    return;
  }
  const tipo = cardActiva.tipo;
  state = resultado.state;
  saveState();
  cerrarModales();
  render();
  showToast(toastPorTipo(tipo));
}

function guardarCard() {
  const desdeAjustes = !els.modalAjustes.hidden;
  const resultado = S.crearCard(state, {
    nombre: els.inputNombreCard.value,
    tipo: els.selectTipoCard.value,
  });
  if (!resultado.ok) {
    showToast(resultado.error);
    return;
  }
  state = resultado.state;
  saveState();
  els.modalCrearCard.hidden = true;
  if (desdeAjustes) {
    renderListaCardsAjustes();
  }
  refrescar();
  showToast("Card creada");
}

function guardarEdicionMonto() {
  if (!movEditandoId) return;
  const resultado = S.editarMontoMovimiento(state, movEditandoId, els.inputEditarMonto.value);
  if (!resultado.ok) {
    showToast(resultado.error);
    els.inputEditarMonto.focus();
    return;
  }
  state = resultado.state;
  saveState();
  cerrarModales();
  render();
  showToast("Monto actualizado");
}

function borrarMovimiento(id) {
  state = S.borrarMovimiento(state, id);
  saveState();
  render();
  showToast("Borrado");
}

function guardarAjustes() {
  const saldo = Number(String(els.inputSaldo.value).replace(",", "."));
  const saldoAhorro = Number(String(els.inputSaldoAhorro.value).replace(",", "."));
  if (!Number.isFinite(saldo) || saldo < 0) {
    showToast("Saldo inválido");
    return;
  }
  if (!Number.isFinite(saldoAhorro) || saldoAhorro < 0) {
    showToast("Ahorro inicial inválido");
    return;
  }
  state = {
    ...state,
    saldoInicial: saldo,
    saldoAhorroInicial: saldoAhorro,
    ahorroActivo: els.toggleAhorro.checked,
  };
  if (state.ahorroActivo) {
    state = S.ensureAhorroCards(state);
  }
  saveState();
  cerrarModales();
  refrescar();
  showToast("Saldos guardados");
}

function actualizarCardDesdeAjustes(cardId) {
  const inputNombre = els.listaCardsAjustes.querySelector(`[data-rename="${cardId}"]`);
  if (!inputNombre) return;
  const resultado = S.renombrarCard(state, cardId, inputNombre.value);
  if (!resultado.ok) {
    showToast(resultado.error);
    return;
  }
  state = resultado.state;
  saveState();
  refrescar();
  renderListaCardsAjustes();
  showToast("Card actualizada");
}

function borrarCardDesdeAjustes(cardId) {
  const resultado = S.borrarCard(state, cardId);
  if (!resultado.ok) {
    showToast(resultado.error);
    return;
  }
  state = resultado.state;
  saveState();
  refrescar();
  const li = els.listaCardsAjustes.querySelector(`[data-borrar-card="${cardId}"]`)?.closest("li");
  li?.remove();
  showToast("Card borrada");
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
    if (e.target.closest("#btn-agregar-card")) {
      abrirModalCrearCard();
      return;
    }
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    const card = state.cards.find((c) => c.id === btn.dataset.id);
    if (card) abrirModalMonto(card);
  });

  els.btnGuardar.addEventListener("click", guardarMovimiento);
  els.inputMonto.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.inputNota.focus();
  });
  els.inputNota.addEventListener("keydown", (e) => {
    if (e.key === "Enter") guardarMovimiento();
  });

  els.btnGuardarCard.addEventListener("click", guardarCard);
  els.inputNombreCard.addEventListener("keydown", (e) => {
    if (e.key === "Enter") guardarCard();
  });

  els.btnGuardarEditarMonto.addEventListener("click", guardarEdicionMonto);
  els.inputEditarMonto.addEventListener("keydown", (e) => {
    if (e.key === "Enter") guardarEdicionMonto();
  });

  els.lista.addEventListener("click", (e) => {
    const btnEditar = e.target.closest("[data-edit]");
    if (btnEditar) {
      const mov = state.movimientos.find((m) => m.id === btnEditar.dataset.edit);
      if (mov) abrirModalEditarMonto(mov);
      return;
    }
    const btnBorrar = e.target.closest("[data-del]");
    if (btnBorrar) borrarMovimiento(btnBorrar.dataset.del);
  });

  els.btnAjustes.addEventListener("click", abrirModalAjustes);
  els.toggleAhorro.addEventListener("change", () => {
    els.bloqueSaldoAhorro.hidden = !els.toggleAhorro.checked;
  });
  els.btnGuardarSaldo.addEventListener("click", guardarAjustes);
  els.btnAgregarCardAjustes.addEventListener("click", () => {
    abrirModalCrearCard();
  });

  els.listaCardsAjustes.addEventListener("click", (e) => {
    const btnGuardarNombre = e.target.closest("[data-guardar-nombre]");
    if (btnGuardarNombre) {
      actualizarCardDesdeAjustes(btnGuardarNombre.dataset.guardarNombre);
      return;
    }
    const btnBorrarCard = e.target.closest("[data-borrar-card]");
    if (btnBorrarCard) borrarCardDesdeAjustes(btnBorrarCard.dataset.borrarCard);
  });

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

refrescar();
wireEvents();
setupInstallHint();
registerSW();
