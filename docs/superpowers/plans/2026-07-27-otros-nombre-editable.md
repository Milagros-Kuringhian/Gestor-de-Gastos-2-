# Nombre editable en Otros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al tocar Otros, el título del modal permite escribir un nombre personalizado que se guarda en el movimiento junto al monto.

**Architecture:** Input `#input-nombre-otros` oculto por defecto; al abrir categoría `otros` se muestra y el `#modal-titulo` se oculta. Al guardar, `nombre` sale del input (trim) o fallback `"Otros"`.

**Tech Stack:** PWA vanilla (HTML/CSS/JS), localStorage `mi-plata-v1`.

## Global Constraints

- Solo categoría `id === "otros"` tiene título editable.
- No cambiar schema de storage; reutilizar campo `nombre`.
- Nombre vacío → `"Otros"`.
- Otras categorías: UX idéntica a hoy.

---

### Task 1: Markup + estilos del título editable

**Files:**
- Modify: `pwa/index.html` (modal monto)
- Modify: `pwa/styles.css` (estilos input título)

- [ ] **Step 1: Agregar input en el modal**

En `pwa/index.html`, junto a `#modal-titulo`:

```html
<h3 id="modal-titulo">Monto</h3>
<label class="sr-only" for="input-nombre-otros">Nombre del gasto</label>
<input
  id="input-nombre-otros"
  class="modal-titulo-input"
  type="text"
  maxlength="60"
  placeholder="Nombre del gasto"
  autocomplete="off"
  hidden
/>
```

Actualizar `aria-labelledby` del dialog para incluir ambos cuando corresponda, o dejar `modal-titulo` y en JS setear `aria-labelledby` al input cuando Otros.

- [ ] **Step 2: Estilos**

En `pwa/styles.css`, después de `.modal-sheet h3`:

```css
.modal-titulo-input {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0.15rem 0;
  border: none;
  border-bottom: 1.5px solid var(--line);
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 1.2rem;
  font-weight: 600;
  outline: none;
}

.modal-titulo-input:focus {
  border-bottom-color: var(--accent);
}

.modal-titulo-input::placeholder {
  color: var(--muted);
  font-weight: 500;
}
```

- [ ] **Step 3: Commit**

```bash
git add pwa/index.html pwa/styles.css
git commit -m "ui: input de nombre en modal para categoría Otros"
```

---

### Task 2: Lógica abrir / guardar / cerrar

**Files:**
- Modify: `pwa/app.js`

- [ ] **Step 1: Referencia al input en `els`**

```js
inputNombreOtros: $("#input-nombre-otros"),
```

- [ ] **Step 2: Actualizar `abrirModalMonto`**

```js
function abrirModalMonto(cat) {
  categoriaActiva = cat;
  els.modalSub.textContent = textoModalPorTipo(cat.tipo);
  els.inputMonto.value = "";
  const esOtros = cat.id === "otros";
  els.modalTitulo.hidden = esOtros;
  els.inputNombreOtros.hidden = !esOtros;
  if (esOtros) {
    els.inputNombreOtros.value = "";
    els.modalMonto.setAttribute("aria-labelledby", "input-nombre-otros");
  } else {
    els.modalTitulo.textContent = cat.nombre;
    els.modalMonto.setAttribute("aria-labelledby", "modal-titulo");
  }
  els.modalMonto.hidden = false;
  setTimeout(() => {
    if (esOtros) els.inputNombreOtros.focus();
    else els.inputMonto.focus();
  }, 50);
}
```

Note: el `aria-labelledby` está en `.modal-sheet`, no en `#modal-monto`. Setear en `els.modalSheet` o `querySelector('.modal-sheet')` del modal monto. Preferir: `els.modalSheetMonto = $("#modal-monto .modal-sheet")`.

- [ ] **Step 3: Actualizar `guardarMovimiento`**

```js
const nombre =
  categoriaActiva.id === "otros"
    ? els.inputNombreOtros.value.trim() || "Otros"
    : categoriaActiva.nombre;
// usar `nombre` en el push en lugar de categoriaActiva.nombre
```

- [ ] **Step 4: En `cerrarModales`, limpiar input nombre**

```js
els.inputNombreOtros.value = "";
els.inputNombreOtros.hidden = true;
els.modalTitulo.hidden = false;
```

- [ ] **Step 5: Verificación manual**

Abrir `pwa/index.html` en el navegador:
1. Otros → escribir "Farmacia" + monto 1500 → Guardar → aparece "Farmacia" en movimientos.
2. Otros → monto sin nombre → se guarda como "Otros".
3. Pádel → título fijo "Pádel", sin input.

- [ ] **Step 6: Commit**

```bash
git add pwa/app.js
git commit -m "feat: guardar nombre personalizado al anotar Otros"
```
