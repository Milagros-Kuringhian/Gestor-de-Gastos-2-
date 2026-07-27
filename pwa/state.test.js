const {
  defaultState,
  migrateV1ToV2,
  totales,
  crearCard,
  renombrarCard,
  borrarCard,
  agregarMovimiento,
  editarMontoMovimiento,
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
