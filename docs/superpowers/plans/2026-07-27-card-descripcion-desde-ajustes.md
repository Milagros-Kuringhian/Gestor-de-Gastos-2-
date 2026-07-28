# Card descripción + crear desde Ajustes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir crear cards desde Ajustes y dar a cada card una descripción opcional visible como subtítulo en la grilla, editable después en Ajustes.

**Architecture:** Extender el estado puro en `pwa/state.js` (`descripcion`, `crearCard`, `actualizarCard`). Reusar el modal Nueva card desde Ajustes sin cerrar Ajustes. UI en `app.js` / `index.html` / estilos mínimos.

**Tech Stack:** PWA vanilla (HTML/CSS/JS), localStorage `mi-plata-v2`, Node `node --test` (`npm test`).

## Global Constraints

- Copy en español rioplatense. Sin rediseño visual grande.
- `descripcion`: string opcional, trim, vacío = `""`, maxlength 60 en UI.
- Descripción no entra en movimientos, modal anotar ni CSV.
- Tipos de card: mismos que hoy (`ingreso`/`gasto`; + `aporte`/`retiro` si `ahorroActivo`).
- Al crear desde Ajustes: Ajustes permanece abierto; solo se cierra el modal Nueva card.
- Storage key sigue `mi-plata-v2` (sin bump de key).
- No tocar `generar_plantilla.js` / Excel.

---

## File map

| File | Responsibility |
|------|----------------|
| `pwa/state.js` | `descripcion` en cards, `crearCard`, `actualizarCard`, normalización |
| `pwa/state.test.js` | Tests de crear/actualizar/normalizar descripción |
| `pwa/index.html` | Input descripción en modal; botón Agregar en Ajustes |
| `pwa/app.js` | Abrir crear desde Ajustes; render subtítulo; guardar nombre+descripción |
| `pwa/styles.css` | Subtítulo en grilla; fila de ajustes con 2 inputs |
| `pwa/sw.js` | Bump caché |

---

### Task 1: Estado — `descripcion` + `actualizarCard`

**Files:**
- Modify: `pwa/state.js`
- Modify: `pwa/state.test.js`

**Interfaces:**
- Consumes: `defaultState`, `crearCard`, `renombrarCard`, `normalizeState` existentes
- Produces:
  - Card shape: `{ id, nombre, descripcion, tipo, obligatoria }` (`descripcion` siempre string)
  - `crearCard(state, { nombre, tipo, descripcion? }): { ok, state?, error? }`
  - `actualizarCard(state, cardId, { nombre, descripcion }): { ok, state?, error? }`
  - `renombrarCard(state, cardId, nombre)` — wrapper que preserva `descripcion` actual vía `actualizarCard`
  - `normalizeState` / `defaultState` / migración: cards con `descripcion: ""` si falta

- [ ] **Step 1: Write the failing tests**

Append to `pwa/state.test.js` (and add `actualizarCard` to the destructured require):

```js
test("crearCard guarda descripcion trim", () => {
  const r = crearCard(defaultState(), {
    nombre: "Pádel",
    tipo: "gasto",
    descripcion: "  cancha  ",
  });
  assert.equal(r.ok, true);
  const card = r.state.cards.find((c) => c.nombre === "Pádel");
  assert.equal(card.descripcion, "cancha");
});

test("crearCard sin descripcion deja string vacío", () => {
  const r = crearCard(defaultState(), { nombre: "Extra", tipo: "ingreso" });
  assert.equal(r.ok, true);
  const card = r.state.cards.find((c) => c.nombre === "Extra");
  assert.equal(card.descripcion, "");
});

test("actualizarCard cambia nombre y descripcion y sync movimientos", () => {
  let s = defaultState();
  s = crearCard(s, { nombre: "Pádel", tipo: "gasto", descripcion: "vieja" }).state;
  const card = s.cards.find((c) => c.nombre === "Pádel");
  s = agregarMovimiento(s, { cardId: card.id, monto: 10, nota: "x" }).state;
  const r = actualizarCard(s, card.id, {
    nombre: "Tenis",
    descripcion: "  club  ",
  });
  assert.equal(r.ok, true);
  const updated = r.state.cards.find((c) => c.id === card.id);
  assert.equal(updated.nombre, "Tenis");
  assert.equal(updated.descripcion, "club");
  assert.equal(r.state.movimientos[0].nombre, "Tenis");
  assert.equal(r.state.movimientos[0].nota, "x");
});

test("actualizarCard permite descripcion vacía", () => {
  let s = defaultState();
  s = crearCard(s, { nombre: "Pádel", tipo: "gasto", descripcion: "algo" }).state;
  const card = s.cards.find((c) => c.nombre === "Pádel");
  const r = actualizarCard(s, card.id, { nombre: "Pádel", descripcion: "   " });
  assert.equal(r.ok, true);
  assert.equal(r.state.cards.find((c) => c.id === card.id).descripcion, "");
});

test("normalizeState rellena descripcion faltante", () => {
  const s = normalizeState({
    cards: [
      { id: "card-ingreso-base", nombre: "Ingreso", tipo: "ingreso", obligatoria: true },
      { id: "card-egreso-base", nombre: "Egreso", tipo: "gasto", obligatoria: true },
      { id: "c1", nombre: "Extra", tipo: "gasto", obligatoria: false },
    ],
    movimientos: [],
  });
  assert.equal(s.cards.find((c) => c.id === "c1").descripcion, "");
});

test("defaultState cards tienen descripcion vacía", () => {
  const s = defaultState();
  assert.ok(s.cards.every((c) => c.descripcion === ""));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL — `actualizarCard` is not a function / `descripcion` undefined / assertions fail.

- [ ] **Step 3: Implement in `pwa/state.js`**

1. In `defaultState()`, add `descripcion: ""` to both base cards.

2. In `ensureBaseCards`, when inserting missing base cards, include `descripcion: ""`.

3. In `migrateV1ToV2`, when building migrated cards, add `descripcion: ""`.

4. Add helper and use it in `normalizeState` when mapping cards:

```js
function normalizeCard(c) {
  const item = c && typeof c === "object" ? c : {};
  return {
    id: item.id,
    nombre: item.nombre || "",
    descripcion: String(item.descripcion || "").trim(),
    tipo: item.tipo || "gasto",
    obligatoria: Boolean(item.obligatoria),
  };
}
```

In `normalizeState`, replace the cards assignment so that when `src.cards` exists and has length, map with `normalizeCard`; otherwise use `base.cards` (already with `descripcion`).

5. Update `crearCard`:

```js
function crearCard(state, { nombre, tipo, descripcion }) {
  const name = String(nombre || "").trim();
  if (!name) return { ok: false, error: "Poné un nombre" };
  const allowed = state.ahorroActivo
    ? ["ingreso", "gasto", "aporte", "retiro"]
    : ["ingreso", "gasto"];
  if (!allowed.includes(tipo)) return { ok: false, error: "Tipo inválido" };
  const card = {
    id: newId("card"),
    nombre: name,
    descripcion: String(descripcion || "").trim(),
    tipo,
    obligatoria: false,
  };
  return { ok: true, state: { ...state, cards: [...state.cards, card] } };
}
```

6. Add `actualizarCard` and make `renombrarCard` a wrapper:

```js
function actualizarCard(state, cardId, { nombre, descripcion }) {
  const name = String(nombre || "").trim();
  if (!name) return { ok: false, error: "Poné un nombre" };
  const desc = String(descripcion ?? "").trim();
  if (!state.cards.some((c) => c.id === cardId)) {
    return { ok: false, error: "Card no encontrada" };
  }
  const cards = state.cards.map((c) =>
    c.id === cardId ? { ...c, nombre: name, descripcion: desc } : c
  );
  const movimientos = state.movimientos.map((m) =>
    m.cardId === cardId ? { ...m, nombre: name } : m
  );
  return { ok: true, state: { ...state, cards, movimientos } };
}

function renombrarCard(state, cardId, nombre) {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return { ok: false, error: "Card no encontrada" };
  return actualizarCard(state, cardId, {
    nombre,
    descripcion: card.descripcion || "",
  });
}
```

7. Export `actualizarCard` in the returned object (and in `module.exports` path via the same return).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add pwa/state.js pwa/state.test.js
git commit -m "$(cat <<'EOF'
feat: descripción en cards y actualizarCard en estado

EOF
)"
```

---

### Task 2: Modal Nueva card + crear desde Ajustes + subtítulo en grilla

**Files:**
- Modify: `pwa/index.html`
- Modify: `pwa/app.js`
- Modify: `pwa/styles.css`

**Interfaces:**
- Consumes: `S.crearCard(state, { nombre, tipo, descripcion })`
- Produces: UI que crea cards con descripción desde home y desde Ajustes; grilla muestra subtítulo

- [ ] **Step 1: Update markup in `pwa/index.html`**

In `#modal-crear-card`, after the nombre input, add:

```html
<label for="input-descripcion-card">Descripción (opcional)</label>
<input
  id="input-descripcion-card"
  type="text"
  maxlength="60"
  placeholder="Ej. cancha los martes"
  autocomplete="off"
/>
```

In `#modal-ajustes`, after `<ul id="lista-cards-ajustes" …></ul>`, add:

```html
<button type="button" class="btn-secondary" id="btn-agregar-card-ajustes">
  Agregar card
</button>
```

Bump script query params: `state.js?v=9` and `app.js?v=9`.

- [ ] **Step 2: Wire UI in `pwa/app.js`**

1. Add to `els`:

```js
inputDescripcionCard: $("#input-descripcion-card"),
btnAgregarCardAjustes: $("#btn-agregar-card-ajustes"),
```

2. Change `cerrarModales` so that if Nueva card está abierta **y** Ajustes también, solo cierra Nueva card:

```js
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
```

3. Update `abrirModalCrearCard`:

```js
function abrirModalCrearCard() {
  poblarSelectTipoCard();
  els.inputNombreCard.value = "";
  els.inputDescripcionCard.value = "";
  els.modalCrearCard.hidden = false;
  setTimeout(() => els.inputNombreCard.focus(), 50);
}
```

4. Update `guardarCard`:

```js
function guardarCard() {
  const desdeAjustes = !els.modalAjustes.hidden;
  const resultado = S.crearCard(state, {
    nombre: els.inputNombreCard.value,
    tipo: els.selectTipoCard.value,
    descripcion: els.inputDescripcionCard.value,
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
```

5. In `renderCategorias`, show descripción when present:

```js
function renderCategorias() {
  const cards = S.visibleCards(state);
  const btns = cards
    .map((cat) => {
      const desc = cat.descripcion
        ? `<span class="desc">${escapeHtml(cat.descripcion)}</span>`
        : "";
      return `
    <button type="button" class="cat-btn ${cat.tipo}" data-id="${cat.id}">
      <span class="tag">${S.tagPorTipo(cat.tipo)}</span>
      <span class="name">${escapeHtml(cat.nombre)}</span>
      ${desc}
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
```

6. In `wireEvents`, after `btnGuardarSaldo` listener (or near Ajustes wiring):

```js
els.btnAgregarCardAjustes.addEventListener("click", () => {
  abrirModalCrearCard();
});
```

(Home `#btn-agregar-card` already calls `abrirModalCrearCard` via grid click.)

- [ ] **Step 3: Styles in `pwa/styles.css`**

```css
.cat-btn .desc {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--muted);
  line-height: 1.25;
}

#btn-agregar-card-ajustes {
  width: 100%;
  margin: 0 0 1rem;
}
```

- [ ] **Step 4: Manual smoke (dev server already `npm run pwa`)**

1. Hard refresh.
2. Home → Agregar → tipo Egreso, nombre “Pádel”, descripción “cancha” → Crear. Card muestra subtítulo.
3. Ajustes → Agregar card → Ingreso “Sueldo”, sin descripción → Crear. Ajustes sigue abierto; la nueva card aparece en la lista; Cancelar en Nueva card no cierra Ajustes.

- [ ] **Step 5: Commit**

```bash
git add pwa/index.html pwa/app.js pwa/styles.css
git commit -m "$(cat <<'EOF'
feat: crear card con descripción desde home y Ajustes

EOF
)"
```

---

### Task 3: Editar nombre + descripción en lista de Ajustes

**Files:**
- Modify: `pwa/app.js`
- Modify: `pwa/styles.css`

**Interfaces:**
- Consumes: `S.actualizarCard(state, cardId, { nombre, descripcion })`
- Produces: fila de Ajustes con ambos campos y un Guardar

- [ ] **Step 1: Update `renderListaCardsAjustes` and save handler**

Replace `renderListaCardsAjustes` body mapping with:

```js
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
        <input type="text" value="${escapeHtml(card.descripcion || "")}" maxlength="60" data-desc="${card.id}" placeholder="Descripción (opcional)" aria-label="Descripción" />
        ${hint}
      </div>
      <button type="button" class="btn-secondary" data-guardar-nombre="${card.id}">Guardar</button>
      <button type="button" class="btn-borrar" data-borrar-card="${card.id}" ${card.obligatoria ? "disabled" : ""}>Borrar</button>
    </li>`;
    })
    .join("");
}
```

Replace `renombrarCardDesdeAjustes` with:

```js
function actualizarCardDesdeAjustes(cardId) {
  const inputNombre = els.listaCardsAjustes.querySelector(`[data-rename="${cardId}"]`);
  const inputDesc = els.listaCardsAjustes.querySelector(`[data-desc="${cardId}"]`);
  if (!inputNombre) return;
  const resultado = S.actualizarCard(state, cardId, {
    nombre: inputNombre.value,
    descripcion: inputDesc ? inputDesc.value : "",
  });
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
```

In `wireEvents`, change the guardar-nombre handler to call `actualizarCardDesdeAjustes(...)`.

- [ ] **Step 2: Adjust CSS if needed**

Ensure `.ajuste-card-info` stacks both inputs (already `flex-direction: column`). Optional tweak:

```css
.lista-cards-ajustes li {
  align-items: start;
}
```

- [ ] **Step 3: Manual smoke**

1. Ajustes → editar descripción de una card → Guardar → cerrar → subtítulo en grilla.
2. Vaciar descripción → Guardar → subtítulo desaparece.
3. Renombrar con movimientos → nombre en historial se actualiza; nota intacta.

- [ ] **Step 4: Commit**

```bash
git add pwa/app.js pwa/styles.css
git commit -m "$(cat <<'EOF'
feat: editar descripción de cards en Ajustes

EOF
)"
```

---

### Task 4: Cache bump + verificación final

**Files:**
- Modify: `pwa/sw.js`

**Interfaces:**
- Consumes: assets ya tocados en tasks 1–3
- Produces: service worker con caché nueva para que clientes carguen JS/CSS nuevos

- [ ] **Step 1: Bump cache name in `pwa/sw.js`**

Change:

```js
const CACHE = "mis-gastos-v9";
```

to:

```js
const CACHE = "mis-gastos-v10";
```

- [ ] **Step 2: Run automated tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Final smoke checklist**

- [ ] Crear desde home con descripción → se ve en grilla
- [ ] Crear desde Ajustes → Ajustes no se cierra; lista se actualiza
- [ ] Cancelar Nueva card con Ajustes abierto → Ajustes sigue
- [ ] Editar descripción en Ajustes → grilla refleja el cambio
- [ ] Cards viejas sin `descripcion` cargan sin error
- [ ] Modal anotar sigue mostrando solo el nombre (sin descripción)

- [ ] **Step 4: Commit**

```bash
git add pwa/sw.js
git commit -m "$(cat <<'EOF'
chore: bump service worker cache a v10

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Campo `descripcion` opcional + normalización | Task 1 |
| `crearCard` con descripción | Task 1 + 2 |
| `actualizarCard` nombre+descripción | Task 1 + 3 |
| Crear desde Ajustes reusando modal | Task 2 |
| Ajustes permanece abierto | Task 2 (`cerrarModales` / `guardarCard`) |
| Subtítulo en grilla | Task 2 |
| Editar en lista Ajustes | Task 3 |
| No en movimientos/CSV/anotar | Tasks 1–3 (no se escribe en movs) |
| Cache bump | Task 4 |

No placeholders remaining. Names consistent: `actualizarCard`, `descripcion`, `input-descripcion-card`, `data-desc`, `btn-agregar-card-ajustes`.
