# Cards personalizables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar categorías fijas por cards que el usuario nombra y administra (mínimo 1 ingreso + 1 egreso), con nota opcional al anotar, edición solo de monto, y ahorro opcional.

**Architecture:** Extraer lógica pura de estado/migración a `pwa/state.js` (testeable con Node). `pwa/app.js` queda como UI: render, modales, eventos. Storage `mi-plata-v2` con migración desde `mi-plata-v1`.

**Tech Stack:** PWA vanilla (HTML/CSS/JS), localStorage, Node built-in test runner (`node --test`).

## Global Constraints

- Siempre ≥ 1 card `ingreso` y ≥ 1 card `gasto` con `obligatoria: true` (ids fijos `card-ingreso-base`, `card-egreso-base`).
- Nombres default: `"Ingreso"` y `"Egreso"`.
- `ahorroActivo: false` por defecto; con ahorro off ocultar total ahorrado y cards `aporte`/`retiro`.
- Anotar: monto > 0 obligatorio; `nota` opcional (trim, vacío = `""`).
- Editar movimiento: solo monto. Renombrar card actualiza `nombre` en card y en sus movimientos (nota intacta).
- Borrar card: prohibido si `obligatoria` o si tiene movimientos.
- Copy en español rioplatense. Sin rediseño visual grande.
- No tocar `generar_plantilla.js` / Excel.

---

## File map

| File | Responsibility |
|------|----------------|
| `pwa/state.js` | defaultState, migrateV1ToV2, load/save helpers, totales, CRUD cards/movimientos puro |
| `pwa/state.test.js` | Tests Node de state.js |
| `pwa/app.js` | DOM, render, modales, wireEvents |
| `pwa/index.html` | Markup: nota, agregar card, editar monto, toggle ahorro, lista cards en ajustes |
| `pwa/styles.css` | Estilos mínimos nuevos |
| `pwa/sw.js` | Bump caché + incluir `state.js` |
| `README.md` | Cómo usarla actualizado |

---

### Task 1: Módulo de estado + migración + tests

**Files:**
- Create: `pwa/state.js`
- Create: `pwa/state.test.js`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `STORAGE_KEY_V1 = "mi-plata-v1"`
  - `STORAGE_KEY_V2 = "mi-plata-v2"`
  - `CARD_INGRESO_BASE_ID = "card-ingreso-base"`
  - `CARD_EGRESO_BASE_ID = "card-egreso-base"`
  - `defaultState(): State`
  - `migrateV1ToV2(v1: object): State`
  - `ensureBaseCards(state: State): State`
  - `totales(state: State): { cobrado, gastado, aportes, retiros, ahorrado, disponible }`
  - `crearCard(state, { nombre, tipo }): { ok, state?, error? }`
  - `renombrarCard(state, cardId, nombre): { ok, state?, error? }`
  - `borrarCard(state, cardId): { ok, state?, error? }`
  - `agregarMovimiento(state, { cardId, monto, nota }): { ok, state?, error? }`
  - `editarMontoMovimiento(state, movId, monto): { ok, state?, error? }`
  - `borrarMovimiento(state, movId): State`
  - `tagPorTipo(tipo): string`
  - `visibleCards(state): Card[]` (filtra aporte/retiro si `!ahorroActivo`)

- [ ] **Step 1: Crear `pwa/state.js` con el modelo y funciones**

```js
export const STORAGE_KEY_V1 = "mi-plata-v1";
export const STORAGE_KEY_V2 = "mi-plata-v2";
export const CARD_INGRESO_BASE_ID = "card-ingreso-base";
export const CARD_EGRESO_BASE_ID = "card-egreso-base";

function newId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultState() {
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

export function ensureBaseCards(state) {
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

export function migrateV1ToV2(v1) {
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

export function totales(state) {
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

export function tagPorTipo(tipo) {
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

export function visibleCards(state) {
  if (state.ahorroActivo) return state.cards;
  return state.cards.filter((c) => c.tipo !== "aporte" && c.tipo !== "retiro");
}

export function crearCard(state, { nombre, tipo }) {
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

export function renombrarCard(state, cardId, nombre) {
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

export function borrarCard(state, cardId) {
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

export function agregarMovimiento(state, { cardId, monto, nota }) {
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

export function editarMontoMovimiento(state, movId, monto) {
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

export function borrarMovimiento(state, movId) {
  return {
    ...state,
    movimientos: state.movimientos.filter((m) => m.id !== movId),
  };
}
```

Nota: si el entorno no soporta `export` en el browser sin type=module, usar IIFE/`window.MiPlataState = {...}` en `state.js` y en tests importar vía `node --experimental-vm-modules` o duplicar el patrón del repo. **Preferir:** en `index.html` cargar con `<script type="module" src="app.js">` y `import * as State from "./state.js"`. En tests: `node --test` con `"type": "module"` solo no aplica al package root (tiene exceljs CJS). Solución: en `state.test.js` usar:

```js
import { createRequire } from "module";
```

Mejor: guardar `state.js` como ESM y en `package.json` agregar:

```json
"type": "module"
```

solo si no rompe `generar_plantilla.js`. Si `generar_plantilla.js` es CJS, **no** poner `"type":"module"`; en su lugar envolver `state.js` así:

```js
const MiPlataState = (() => {
  // ... todas las funciones ...
  return { STORAGE_KEY_V1, STORAGE_KEY_V2, /* ...exports... */ };
})();
if (typeof module !== "undefined" && module.exports) {
  module.exports = MiPlataState;
}
```

Y en `app.js` (script clásico): usar `MiPlataState` global vía `<script src="state.js?v=8"></script>` antes de `app.js`.

**Usar el patrón IIFE + `module.exports` + global `MiPlataState`** para no pelear con el package CJS existente.

- [ ] **Step 2: Escribir `pwa/state.test.js`**

```js
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
```

- [ ] **Step 3: Agregar script test y correr**

En `package.json`:

```json
"scripts": {
  "generar": "node generar_plantilla.js",
  "pwa": "npx --yes serve pwa -p 4173",
  "test": "node --test pwa/state.test.js"
}
```

Run: `npm test`  
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add pwa/state.js pwa/state.test.js package.json
git commit -m "feat: estado v2 con cards, migración y tests"
```

---

### Task 2: Markup HTML (modales y home)

**Files:**
- Modify: `pwa/index.html`

**Interfaces:**
- Consumes: ids de DOM que usará `app.js`
- Produces: elementos `#input-nota`, `#modal-crear-card`, `#modal-editar-monto`, `#toggle-ahorro`, `#lista-cards-ajustes`, `#btn-agregar-card`, `#ahorro-total-wrap`

- [ ] **Step 1: Actualizar balance — envolver Ahorrado**

En la fila de balance, envolver el bloque Ahorrado:

```html
<div id="ahorro-total-wrap">
  <span>Ahorrado</span>
  <strong id="total-ahorrado">$0</strong>
</div>
```

- [ ] **Step 2: Sección Anotar — botón Agregar**

Después de `#cat-grid`:

```html
<button type="button" class="cat-btn add-card" id="btn-agregar-card">
  <span class="tag">Nueva</span>
  <span class="name">Agregar</span>
</button>
```

(O incluir el botón dentro del render JS; si es estático en HTML, ponerlo fuera del grid y estilizar fila. Preferible: el botón se renderiza desde JS al final de la grilla en Task 4. En HTML dejar solo `#cat-grid` vacío.)

- [ ] **Step 3: Modal monto — quitar Otros, agregar nota**

Reemplazar el bloque del modal monto por:

```html
<div class="modal" id="modal-monto" hidden>
  <div class="modal-backdrop" data-close></div>
  <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
    <h3 id="modal-titulo">Monto</h3>
    <p class="modal-sub" id="modal-sub"></p>
    <label class="sr-only" for="input-monto">Monto en pesos</label>
    <div class="monto-wrap">
      <span>$</span>
      <input id="input-monto" type="number" inputmode="decimal" min="0" step="1" placeholder="0" autocomplete="off" />
    </div>
    <label for="input-nota">Nota (opcional)</label>
    <input id="input-nota" type="text" maxlength="80" placeholder="Ej. almuerzo" autocomplete="off" />
    <div class="modal-actions">
      <button type="button" class="btn-secondary" data-close>Cancelar</button>
      <button type="button" class="btn-primary" id="btn-guardar">Guardar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Modal crear card**

```html
<div class="modal" id="modal-crear-card" hidden>
  <div class="modal-backdrop" data-close></div>
  <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="crear-card-titulo">
    <h3 id="crear-card-titulo">Nueva card</h3>
    <label for="select-tipo-card">Tipo</label>
    <select id="select-tipo-card">
      <option value="ingreso">Ingreso</option>
      <option value="gasto">Egreso</option>
    </select>
    <label for="input-nombre-card">Nombre</label>
    <input id="input-nombre-card" type="text" maxlength="40" placeholder="Ej. Pádel" autocomplete="off" />
    <div class="modal-actions">
      <button type="button" class="btn-secondary" data-close>Cancelar</button>
      <button type="button" class="btn-primary" id="btn-guardar-card">Crear</button>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Modal editar monto**

```html
<div class="modal" id="modal-editar-monto" hidden>
  <div class="modal-backdrop" data-close></div>
  <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="editar-monto-titulo">
    <h3 id="editar-monto-titulo">Editar monto</h3>
    <p class="modal-sub" id="editar-monto-sub"></p>
    <label class="sr-only" for="input-editar-monto">Monto</label>
    <div class="monto-wrap">
      <span>$</span>
      <input id="input-editar-monto" type="number" inputmode="decimal" min="0" step="1" placeholder="0" />
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" data-close>Cancelar</button>
      <button type="button" class="btn-primary" id="btn-guardar-editar-monto">Guardar</button>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Ajustes — toggle ahorro + lista cards**

Dentro de `#modal-ajustes`, antes del hint, agregar:

```html
<label class="toggle-row" for="toggle-ahorro">
  <span>Usar ahorro</span>
  <input type="checkbox" id="toggle-ahorro" />
</label>
<div id="bloque-saldo-ahorro">
  <label for="input-saldo-ahorro">Saldo inicial (ahorro)</label>
  <!-- input-saldo-ahorro existente se mueve acá -->
</div>
```

Después del hint, antes de acciones:

```html
<h4 class="ajustes-subtitulo">Tus cards</h4>
<ul id="lista-cards-ajustes" class="lista-cards-ajustes"></ul>
```

- [ ] **Step 7: Scripts**

Antes de `app.js`:

```html
<script src="state.js?v=8"></script>
<script src="app.js?v=8"></script>
```

Bump CSS query a `?v=8`.

- [ ] **Step 8: Commit**

```bash
git add pwa/index.html
git commit -m "ui: markup para cards, nota, ahorro y editar monto"
```

---

### Task 3: Estilos mínimos

**Files:**
- Modify: `pwa/styles.css`

- [ ] **Step 1: Agregar estilos**

```css
.cat-btn.add-card {
  border-style: dashed;
  background: transparent;
  color: var(--muted);
}

.cat-btn.add-card .name {
  color: var(--ink);
}

#input-nota,
#input-nombre-card,
#select-tipo-card {
  width: 100%;
  margin: 0.5rem 0 1rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1rem 0;
  font-weight: 600;
}

.lista-cards-ajustes {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  display: grid;
  gap: 0.5rem;
}

.lista-cards-ajustes li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.4rem;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--line);
}

.lista-cards-ajustes input[type="text"] {
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  font: inherit;
}

.ajustes-subtitulo {
  margin: 1rem 0 0.5rem;
  font-size: 0.95rem;
}

.lista .nota {
  display: block;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 400;
}

.lista .btn-editar {
  /* reutilizar look de btn-borrar o ghost pequeño */
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
```

- [ ] **Step 2: Commit**

```bash
git add pwa/styles.css
git commit -m "style: cards agregar, nota y lista en ajustes"
```

---

### Task 4: Reescribir `app.js` — load/save, render, anotar, CRUD UI

**Files:**
- Modify: `pwa/app.js` (reescritura orientada a `MiPlataState`)

**Interfaces:**
- Consumes: todo el API de Task 1 (`MiPlataState.*`)
- Produces: app funcional en browser

- [ ] **Step 1: Load/save con migración**

```js
const S = MiPlataState;

function loadState() {
  try {
    const rawV2 = localStorage.getItem(S.STORAGE_KEY_V2);
    if (rawV2) {
      return S.ensureBaseCards({ ...S.defaultState(), ...JSON.parse(rawV2) });
    }
    const rawV1 = localStorage.getItem(S.STORAGE_KEY_V1);
    if (rawV1) {
      const migrated = S.migrateV1ToV2(JSON.parse(rawV1));
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
```

- [ ] **Step 2: `renderCategorias` desde `visibleCards` + botón Agregar**

```js
function renderCategorias() {
  const cards = S.visibleCards(state);
  const btns = cards
    .map(
      (cat) => `
    <button type="button" class="cat-btn ${cat.tipo}" data-id="${cat.id}">
      <span class="tag">${S.tagPorTipo(cat.tipo)}</span>
      <span class="name">${escapeHtml(cat.nombre)}</span>
    </button>`
    )
    .join("");
  const add = `
    <button type="button" class="cat-btn add-card" id="btn-agregar-card">
      <span class="tag">Nueva</span>
      <span class="name">Agregar</span>
    </button>`;
  els.grid.innerHTML = btns + add;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
```

- [ ] **Step 3: Modal anotar con nota**

`abrirModalMonto(card)`: título = `card.nombre`, limpiar monto y nota, foco en monto.  
`guardarMovimiento`: `S.agregarMovimiento(state, { cardId, monto, nota })`.

- [ ] **Step 4: Crear card modal**

Al tocar `#btn-agregar-card`: abrir `#modal-crear-card`.  
Poblar `#select-tipo-card`: si `state.ahorroActivo`, opciones ingreso/gasto/aporte/retiro; si no, solo ingreso/gasto.  
`btn-guardar-card` → `S.crearCard` → save → render → toast `"Card creada"`.

- [ ] **Step 5: Lista movimientos con nota + Editar + Borrar**

```js
<strong>${escapeHtml(mov.nombre)}</strong>
${mov.nota ? `<span class="nota">${escapeHtml(mov.nota)}</span>` : ""}
...
<button type="button" class="btn-editar" data-edit="${mov.id}">Editar</button>
<button type="button" class="btn-borrar" data-del="${mov.id}">Borrar</button>
```

- [ ] **Step 6: Editar monto**

`data-edit` abre `#modal-editar-monto` con sub = nombre (+ nota). Guardar → `S.editarMontoMovimiento`.

- [ ] **Step 7: Ajustes — toggle, saldos, lista cards**

- `#toggle-ahorro` checked = `state.ahorroActivo`; al guardar saldos persistir toggle.
- Mostrar/ocultar `#bloque-saldo-ahorro` y `#ahorro-total-wrap` según toggle/estado.
- `renderListaCardsAjustes`: cada card con input nombre + botón Guardar nombre + Borrar (disabled/oculto si obligatoria).
- Renombrar → `S.renombrarCard`; borrar → `S.borrarCard` + toast de error si falla.

- [ ] **Step 8: CSV con nota**

Header: `fecha,tipo,categoria,nota,monto`

- [ ] **Step 9: Quitar `CATEGORIAS` hardcodeadas e `input-nombre-otros`**

- [ ] **Step 10: Verificación manual**

Run: `npm run pwa` → `http://localhost:4173`  
Checklist:
1. Ver Ingreso + Egreso + Agregar.
2. Renombrar en Ajustes.
3. Crear “Pádel”, anotar 1000 con nota “cancha”.
4. Editar monto a 1200.
5. Activar ahorro, crear “Ahorré”, anotar; ver total ahorrado.
6. Desactivar ahorro: cards aporte ocultas; disponible sigue coherente.
7. Recargar: datos persisten.

- [ ] **Step 11: Commit**

```bash
git add pwa/app.js
git commit -m "feat: UI de cards personalizables, nota y ahorro opcional"
```

---

### Task 5: Service worker + README

**Files:**
- Modify: `pwa/sw.js`
- Modify: `README.md`

- [ ] **Step 1: Bump SW**

```js
const CACHE = "mis-gastos-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./state.js",
  "./app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];
```

- [ ] **Step 2: Actualizar README “Cómo usarla”**

```markdown
### Cómo usarla

1. Arrancás con dos cards: **Ingreso** y **Egreso** (renombrables en Ajustes; no se borran).
2. Tocá **Agregar** para crear más cards con el nombre que quieras.
3. Tocá una card → monto + nota opcional → Guardar.
4. En la lista podés **Editar** el monto o **Borrar**.
5. **Ajustes** → saldo inicial; opcionalmente activá **Usar ahorro**.
6. **Exportar CSV** cuando quieras un respaldo.
```

- [ ] **Step 3: Commit**

```bash
git add pwa/sw.js README.md
git commit -m "chore: caché v8 y README de cards personalizables"
```

---

## Spec coverage checklist

| Requisito | Task |
|-----------|------|
| 2 cards obligatorias default | 1, 4 |
| Agregar cards | 1, 2, 4 |
| Anotar monto + nota | 1, 2, 4 |
| Editar solo monto | 1, 2, 4 |
| Renombrar / borrar (reglas) | 1, 4 |
| Ahorro opcional | 1, 2, 4 |
| Migración v1→v2 | 1, 4 |
| CSV con nota | 4 |
| SW + README | 5 |

## Self-review notes

- Sin placeholders TBD.
- API de estado consistente (`ok`/`state`/`error`) en todas las mutaciones excepto `borrarMovimiento` (devuelve state directo, igual que patrón simple).
- `tagPorTipo` cubre ingreso/gasto/aporte/retiro; default `"Movimiento"`.
- Plan alineado a la spec aprobada; verificación con `npm test` + checklist manual en Task 4.
