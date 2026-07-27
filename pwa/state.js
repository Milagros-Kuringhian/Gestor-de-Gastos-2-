const MiPlataState = (() => {
  const STORAGE_KEY_V1 = "mi-plata-v1";
  const STORAGE_KEY_V2 = "mi-plata-v2";
  const CARD_INGRESO_BASE_ID = "card-ingreso-base";
  const CARD_EGRESO_BASE_ID = "card-egreso-base";

  function newId(prefix) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function defaultState() {
    return {
      saldoInicial: 0,
      ahorroActivo: false,
      saldoAhorroInicial: 0,
      cards: [
        {
          id: CARD_INGRESO_BASE_ID,
          nombre: "Ingreso",
          tipo: "ingreso",
          obligatoria: true,
        },
        {
          id: CARD_EGRESO_BASE_ID,
          nombre: "Egreso",
          tipo: "gasto",
          obligatoria: true,
        },
      ],
      movimientos: [],
    };
  }

  function ensureBaseCards(state) {
    const cards = [...(state.cards || [])];
    if (!cards.some((c) => c.id === CARD_INGRESO_BASE_ID)) {
      cards.unshift({
        id: CARD_INGRESO_BASE_ID,
        nombre: "Ingreso",
        tipo: "ingreso",
        obligatoria: true,
      });
    }
    if (!cards.some((c) => c.id === CARD_EGRESO_BASE_ID)) {
      cards.push({
        id: CARD_EGRESO_BASE_ID,
        nombre: "Egreso",
        tipo: "gasto",
        obligatoria: true,
      });
    }
    return { ...state, cards };
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function normalizeMovimiento(m) {
    const item = m && typeof m === "object" ? m : {};
    const monto = Number(item.monto);
    return {
      id: item.id || newId("m"),
      cardId: item.cardId,
      nombre: item.nombre || "",
      nota: item.nota || "",
      tipo: item.tipo || "gasto",
      monto: Number.isFinite(monto) ? monto : 0,
      fechaISO: item.fechaISO || todayISO(),
      createdAt: item.createdAt || Date.now(),
    };
  }

  function normalizeState(parsed) {
    const base = defaultState();
    const src = parsed && typeof parsed === "object" ? parsed : {};
    const movimientosRaw = Array.isArray(src.movimientos) ? src.movimientos : [];
    const merged = {
      ...base,
      ...src,
      saldoInicial: Number(src.saldoInicial) || 0,
      saldoAhorroInicial: Number(src.saldoAhorroInicial) || 0,
      ahorroActivo: Boolean(src.ahorroActivo),
      cards: Array.isArray(src.cards) && src.cards.length ? src.cards : base.cards,
      movimientos: movimientosRaw.map(normalizeMovimiento),
    };
    return ensureBaseCards(merged);
  }

  function migrateV1ToV2(v1) {
    const base = defaultState();
    base.saldoInicial = Number(v1.saldoInicial) || 0;
    base.saldoAhorroInicial = Number(v1.saldoAhorroInicial) || 0;
    const movs = Array.isArray(v1.movimientos) ? v1.movimientos : [];
    const byCat = new Map();
    for (const m of movs) {
      const cid = m.categoriaId || "desconocido";
      if (!byCat.has(cid)) {
        byCat.set(cid, {
          id: `card-migrated-${cid}`,
          nombre: m.nombre || cid,
          tipo: m.tipo || "gasto",
          obligatoria: false,
        });
      }
    }
    base.cards = [...base.cards, ...byCat.values()];
    base.ahorroActivo = movs.some((m) => m.tipo === "aporte" || m.tipo === "retiro");
    base.movimientos = movs.map((m) => {
      const cid = m.categoriaId || "desconocido";
      return {
        id: m.id || newId("m"),
        cardId: `card-migrated-${cid}`,
        nombre: m.nombre || cid,
        nota: "",
        tipo: m.tipo || "gasto",
        monto: Number(m.monto) || 0,
        fechaISO: m.fechaISO,
        createdAt: m.createdAt || Date.now(),
      };
    });
    return ensureBaseCards(base);
  }

  function totales(state) {
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

  function tagPorTipo(tipo) {
    switch (tipo) {
      case "ingreso":
        return "Ingreso";
      case "gasto":
        return "Egreso";
      case "aporte":
        return "Ahorro";
      case "retiro":
        return "Ahorro";
      default:
        return "Movimiento";
    }
  }

  function visibleCards(state) {
    if (state.ahorroActivo) return state.cards;
    return state.cards.filter((c) => c.tipo !== "aporte" && c.tipo !== "retiro");
  }

  function crearCard(state, { nombre, tipo }) {
    const name = String(nombre || "").trim();
    if (!name) return { ok: false, error: "Poné un nombre" };
    const allowed = state.ahorroActivo
      ? ["ingreso", "gasto", "aporte", "retiro"]
      : ["ingreso", "gasto"];
    if (!allowed.includes(tipo)) return { ok: false, error: "Tipo inválido" };
    const card = {
      id: newId("card"),
      nombre: name,
      tipo,
      obligatoria: false,
    };
    return { ok: true, state: { ...state, cards: [...state.cards, card] } };
  }

  function renombrarCard(state, cardId, nombre) {
    const name = String(nombre || "").trim();
    if (!name) return { ok: false, error: "Poné un nombre" };
    const cards = state.cards.map((c) =>
      c.id === cardId ? { ...c, nombre: name } : c
    );
    if (!cards.some((c) => c.id === cardId)) {
      return { ok: false, error: "Card no encontrada" };
    }
    const movimientos = state.movimientos.map((m) =>
      m.cardId === cardId ? { ...m, nombre: name } : m
    );
    return { ok: true, state: { ...state, cards, movimientos } };
  }

  function borrarCard(state, cardId) {
    const card = state.cards.find((c) => c.id === cardId);
    if (!card) return { ok: false, error: "Card no encontrada" };
    if (card.obligatoria) {
      return { ok: false, error: "Esa card no se puede borrar" };
    }
    if (state.movimientos.some((m) => m.cardId === cardId)) {
      return {
        ok: false,
        error: "Borrá primero los movimientos de esa card",
      };
    }
    return {
      ok: true,
      state: { ...state, cards: state.cards.filter((c) => c.id !== cardId) },
    };
  }

  function agregarMovimiento(state, { cardId, monto, nota }) {
    const card = state.cards.find((c) => c.id === cardId);
    if (!card) return { ok: false, error: "Card no encontrada" };
    const n = Number(String(monto).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: "Poné un monto válido" };
    }
    if (
      !state.ahorroActivo &&
      (card.tipo === "aporte" || card.tipo === "retiro")
    ) {
      return { ok: false, error: "Activá el ahorro en Ajustes" };
    }
    const hoy = new Date();
    const fechaISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    const mov = {
      id: newId("m"),
      cardId: card.id,
      nombre: card.nombre,
      nota: String(nota || "").trim(),
      tipo: card.tipo,
      monto: n,
      fechaISO,
      createdAt: Date.now(),
    };
    return {
      ok: true,
      state: { ...state, movimientos: [...state.movimientos, mov] },
    };
  }

  function editarMontoMovimiento(state, movId, monto) {
    const n = Number(String(monto).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: "Poné un monto válido" };
    }
    let found = false;
    const movimientos = state.movimientos.map((m) => {
      if (m.id !== movId) return m;
      found = true;
      return { ...m, monto: n };
    });
    if (!found) return { ok: false, error: "Movimiento no encontrado" };
    return { ok: true, state: { ...state, movimientos } };
  }

  function borrarMovimiento(state, movId) {
    return {
      ...state,
      movimientos: state.movimientos.filter((m) => m.id !== movId),
    };
  }

  return {
    STORAGE_KEY_V1,
    STORAGE_KEY_V2,
    CARD_INGRESO_BASE_ID,
    CARD_EGRESO_BASE_ID,
    defaultState,
    migrateV1ToV2,
    ensureBaseCards,
    normalizeState,
    totales,
    crearCard,
    renombrarCard,
    borrarCard,
    agregarMovimiento,
    editarMontoMovimiento,
    borrarMovimiento,
    tagPorTipo,
    visibleCards,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MiPlataState;
}

if (typeof window !== "undefined") {
  window.MiPlataState = MiPlataState;
}
