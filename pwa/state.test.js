const {
  defaultState,
  migrateV1ToV2,
  normalizeState,
  ensureBaseCards,
  totales,
  crearCard,
  renombrarCard,
  borrarCard,
  agregarMovimiento,
  editarMontoMovimiento,
  borrarMovimiento,
  tagPorTipo,
  visibleCards,
  CARD_INGRESO_BASE_ID,
  CARD_EGRESO_BASE_ID,
} = require("./state.js");
const test = require("node:test");
const assert = require("node:assert/strict");

test("defaultState tiene 2 cards obligatorias", () => {
  const s = defaultState();
  assert.equal(s.cards.length, 2);
  assert.equal(s.ahorroActivo, false);
  assert.ok(s.cards.every((c) => c.obligatoria));
});

test("crearCard agrega gasto extra", () => {
  let s = defaultState();
  const r = crearCard(s, { nombre: "Pádel", tipo: "gasto" });
  assert.equal(r.ok, true);
  assert.equal(r.state.cards.length, 3);
});

test("borrarCard falla en obligatoria", () => {
  const r = borrarCard(defaultState(), CARD_INGRESO_BASE_ID);
  assert.equal(r.ok, false);
});

test("borrarCard falla si tiene movimientos", () => {
  let s = defaultState();
  s = crearCard(s, { nombre: "Pádel", tipo: "gasto" }).state;
  const card = s.cards.find((c) => c.nombre === "Pádel");
  s = agregarMovimiento(s, { cardId: card.id, monto: 10, nota: "" }).state;
  const r = borrarCard(s, card.id);
  assert.equal(r.ok, false);
});

test("renombrarCard actualiza movimientos", () => {
  let s = defaultState();
  s = agregarMovimiento(s, {
    cardId: CARD_EGRESO_BASE_ID,
    monto: 100,
    nota: "x",
  }).state;
  s = renombrarCard(s, CARD_EGRESO_BASE_ID, "Comida").state;
  assert.equal(s.cards.find((c) => c.id === CARD_EGRESO_BASE_ID).nombre, "Comida");
  assert.equal(s.movimientos[0].nombre, "Comida");
  assert.equal(s.movimientos[0].nota, "x");
});

test("visibleCards oculta ahorro si inactivo", () => {
  let s = defaultState();
  s.ahorroActivo = true;
  s = crearCard(s, { nombre: "Ahorré", tipo: "aporte" }).state;
  s.ahorroActivo = false;
  const vis = visibleCards(s);
  assert.ok(vis.every((c) => c.tipo !== "aporte"));
});

test("totales calcula disponible", () => {
  let s = defaultState();
  s.saldoInicial = 1000;
  s = agregarMovimiento(s, {
    cardId: CARD_INGRESO_BASE_ID,
    monto: 500,
    nota: "",
  }).state;
  s = agregarMovimiento(s, {
    cardId: CARD_EGRESO_BASE_ID,
    monto: 200,
    nota: "",
  }).state;
  assert.equal(totales(s).disponible, 1300);
});

test("migrateV1ToV2 conserva movimientos y crea cards", () => {
  const v1 = {
    saldoInicial: 50,
    saldoAhorroInicial: 10,
    movimientos: [
      {
        id: "1",
        categoriaId: "padel",
        nombre: "Pádel",
        tipo: "gasto",
        monto: 20,
        fechaISO: "2026-07-01",
        createdAt: 1,
      },
    ],
  };
  const s = migrateV1ToV2(v1);
  assert.equal(s.saldoInicial, 50);
  assert.ok(s.cards.some((c) => c.nombre === "Pádel"));
  assert.equal(s.movimientos.length, 1);
  assert.equal(s.movimientos[0].cardId, "card-migrated-padel");
  assert.ok(s.cards.some((c) => c.id === CARD_INGRESO_BASE_ID));
});

test("normalizeState coerce saldos y booleanos con datos corruptos", () => {
  const s = normalizeState({
    saldoInicial: "no-es-numero",
    saldoAhorroInicial: undefined,
    ahorroActivo: "true",
    cards: "no-es-array",
    movimientos: null,
  });
  assert.equal(s.saldoInicial, 0);
  assert.equal(s.saldoAhorroInicial, 0);
  assert.equal(s.ahorroActivo, true);
  assert.ok(Array.isArray(s.cards));
  assert.ok(s.cards.some((c) => c.id === CARD_INGRESO_BASE_ID));
  assert.ok(s.cards.some((c) => c.id === CARD_EGRESO_BASE_ID));
  assert.deepEqual(s.movimientos, []);
});

test("normalizeState conserva valores válidos y agrega cards base faltantes", () => {
  const s = normalizeState({
    saldoInicial: 250,
    saldoAhorroInicial: 30,
    ahorroActivo: true,
    cards: [{ id: "card-x", nombre: "Extra", tipo: "gasto", obligatoria: false }],
    movimientos: [
      { id: "m1", cardId: "card-x", nombre: "Extra", nota: "", tipo: "gasto", monto: 10, fechaISO: "2026-01-01", createdAt: 1 },
    ],
  });
  assert.equal(s.saldoInicial, 250);
  assert.equal(s.saldoAhorroInicial, 30);
  assert.equal(s.ahorroActivo, true);
  assert.equal(s.movimientos.length, 1);
  assert.ok(s.cards.some((c) => c.id === "card-x"));
  assert.ok(s.cards.some((c) => c.id === CARD_INGRESO_BASE_ID));
  assert.ok(s.cards.some((c) => c.id === CARD_EGRESO_BASE_ID));
});

test("normalizeState maneja objeto vacío o inválido sin tirar error", () => {
  const s1 = normalizeState({});
  assert.equal(s1.saldoInicial, 0);
  assert.equal(s1.cards.length, 2);

  const s2 = normalizeState(null);
  assert.equal(s2.saldoInicial, 0);
  assert.equal(s2.cards.length, 2);
});

test("editarMontoMovimiento", () => {
  let s = defaultState();
  s = agregarMovimiento(s, {
    cardId: CARD_EGRESO_BASE_ID,
    monto: 10,
    nota: "",
  }).state;
  const id = s.movimientos[0].id;
  s = editarMontoMovimiento(s, id, 55).state;
  assert.equal(s.movimientos[0].monto, 55);
});

test("agregarMovimiento falla con monto inválido o cero", () => {
  const s = defaultState();
  assert.equal(agregarMovimiento(s, { cardId: CARD_INGRESO_BASE_ID, monto: 0, nota: "" }).ok, false);
  assert.equal(agregarMovimiento(s, { cardId: CARD_INGRESO_BASE_ID, monto: -5, nota: "" }).ok, false);
  assert.equal(agregarMovimiento(s, { cardId: CARD_INGRESO_BASE_ID, monto: "abc", nota: "" }).ok, false);
});

test("agregarMovimiento falla con card inexistente", () => {
  const s = defaultState();
  const r = agregarMovimiento(s, { cardId: "no-existe", monto: 10, nota: "" });
  assert.equal(r.ok, false);
});

test("agregarMovimiento falla aporte/retiro cuando ahorro está inactivo", () => {
  let s = defaultState();
  s.ahorroActivo = true;
  s = crearCard(s, { nombre: "Ahorré", tipo: "aporte" }).state;
  const card = s.cards.find((c) => c.tipo === "aporte");
  s.ahorroActivo = false;
  const r = agregarMovimiento(s, { cardId: card.id, monto: 100, nota: "" });
  assert.equal(r.ok, false);
});

test("agregarMovimiento recorta la nota (trim)", () => {
  const s = defaultState();
  const r = agregarMovimiento(s, {
    cardId: CARD_INGRESO_BASE_ID,
    monto: 10,
    nota: "  con espacios  ",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state.movimientos[0].nota, "con espacios");
});

test("crearCard falla con nombre vacío", () => {
  const r = crearCard(defaultState(), { nombre: "   ", tipo: "gasto" });
  assert.equal(r.ok, false);
});

test("crearCard falla con tipo inválido", () => {
  const r = crearCard(defaultState(), { nombre: "Algo", tipo: "no-existe" });
  assert.equal(r.ok, false);
});

test("renombrarCard falla con nombre vacío", () => {
  const r = renombrarCard(defaultState(), CARD_INGRESO_BASE_ID, "   ");
  assert.equal(r.ok, false);
});

test("renombrarCard falla con card inexistente", () => {
  const r = renombrarCard(defaultState(), "no-existe", "Nuevo nombre");
  assert.equal(r.ok, false);
});

test("editarMontoMovimiento falla con monto inválido", () => {
  let s = defaultState();
  s = agregarMovimiento(s, { cardId: CARD_EGRESO_BASE_ID, monto: 10, nota: "" }).state;
  const id = s.movimientos[0].id;
  assert.equal(editarMontoMovimiento(s, id, 0).ok, false);
  assert.equal(editarMontoMovimiento(s, id, "no-es-numero").ok, false);
});

test("editarMontoMovimiento falla con movimiento inexistente", () => {
  const s = defaultState();
  const r = editarMontoMovimiento(s, "no-existe", 10);
  assert.equal(r.ok, false);
});

test("borrarMovimiento elimina el movimiento indicado", () => {
  let s = defaultState();
  s = agregarMovimiento(s, { cardId: CARD_EGRESO_BASE_ID, monto: 10, nota: "" }).state;
  const id = s.movimientos[0].id;
  s = borrarMovimiento(s, id);
  assert.equal(s.movimientos.length, 0);
});

test("tagPorTipo devuelve la etiqueta esperada por tipo", () => {
  assert.equal(tagPorTipo("ingreso"), "Ingreso");
  assert.equal(tagPorTipo("gasto"), "Egreso");
  assert.equal(tagPorTipo("aporte"), "Ahorro");
  assert.equal(tagPorTipo("retiro"), "Ahorro");
  assert.equal(tagPorTipo("otro"), "Movimiento");
});

test("ensureBaseCards agrega las cards obligatorias si faltan", () => {
  const s = ensureBaseCards({ cards: [] });
  assert.ok(s.cards.some((c) => c.id === CARD_INGRESO_BASE_ID));
  assert.ok(s.cards.some((c) => c.id === CARD_EGRESO_BASE_ID));
});

test("migrateV1ToV2 activa ahorroActivo cuando hay aportes o retiros", () => {
  const v1 = {
    saldoInicial: 0,
    movimientos: [
      { id: "1", categoriaId: "ahorro", nombre: "Ahorro", tipo: "aporte", monto: 100, fechaISO: "2026-01-01", createdAt: 1 },
    ],
  };
  const s = migrateV1ToV2(v1);
  assert.equal(s.ahorroActivo, true);
});

test("normalizeState sanea movimientos con monto inválido y fecha faltante", () => {
  const s = normalizeState({
    cards: [{ id: CARD_INGRESO_BASE_ID, nombre: "Ingreso", tipo: "ingreso", obligatoria: true }],
    movimientos: [
      { id: "m1", cardId: CARD_INGRESO_BASE_ID, nombre: "X", tipo: "ingreso", monto: "no-es-numero" },
      { id: "m2", cardId: CARD_INGRESO_BASE_ID, nombre: "Y", tipo: "ingreso", monto: 50, fechaISO: "2026-02-02" },
    ],
  });
  assert.equal(s.movimientos[0].monto, 0);
  assert.equal(typeof s.movimientos[0].fechaISO, "string");
  assert.ok(s.movimientos[0].fechaISO.length > 0);
  assert.equal(s.movimientos[1].monto, 50);
  assert.equal(s.movimientos[1].fechaISO, "2026-02-02");
});
