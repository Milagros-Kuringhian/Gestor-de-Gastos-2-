# Ahorro cards al activar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement inline with TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al activar “Usar ahorro” en Ajustes y guardar, crear (si faltan) cards Aporte/Retiro y mostrarlas en el inicio junto al total Ahorrado.

**Architecture:** Nueva función pura `ensureAhorroCards(state)` en `state.js`, idempotente. Se invoca al guardar ajustes con ahorro activo y al cargar estado si `ahorroActivo`. La UI de visibilidad ya existe (`visibleCards`, `#ahorro-total-wrap`).

**Tech Stack:** PWA vanilla JS, Node `node:test` en `pwa/state.test.js`.

## Global Constraints

- Ahorro en inicio solo si `ahorroActivo === true`.
- Aporte no suma a Gastado; retiro no suma a Cobrado (fórmulas actuales).
- No duplicar cards si ya hay alguna `aporte` / `retiro`.
- IDs estables: `card-aporte-base`, `card-retiro-base`.
- Español rioplatense.

---

### Task 1: `ensureAhorroCards` en state

**Files:**
- Modify: `pwa/state.js`
- Test: `pwa/state.test.js`

**Interfaces:**
- Produces: `ensureAhorroCards(state) → state`, `CARD_APORTE_BASE_ID`, `CARD_RETIRO_BASE_ID`

- [ ] **Step 1: Test fallido** — crea aporte/retiro si faltan; no duplica; no-op si ahorro off no requerido (la función siempre asegura cards; el caller decide cuándo).

- [ ] **Step 2: Implementar** `ensureAhorroCards` + exportar constantes.

- [ ] **Step 3: Tests verdes** — `node --test pwa/state.test.js`

### Task 2: Wire en app al guardar / cargar

**Files:**
- Modify: `pwa/app.js` (`guardarAjustes`, carga inicial / `loadState`)
- Modify: `pwa/sw.js` (bump CACHE), `pwa/index.html` (cache bust scripts)

- [ ] **Step 1:** Tras setear `ahorroActivo: true` en `guardarAjustes`, `state = S.ensureAhorroCards(state)`.
- [ ] **Step 2:** Tras `loadState` / normalize, si `state.ahorroActivo`, `ensureAhorroCards`.
- [ ] **Step 3:** Bump caché SW + query `?v=` en scripts/CSS.

### Task 3: Verificación manual checklist

- [ ] Ahorro off → sin Ahorrado ni cards ahorro.
- [ ] Activar + Guardar → Aporte/Retiro en Anotar + Ahorrado en balance.
- [ ] Aporte: Disponible baja, Ahorrado sube, Gastado igual.
- [ ] Desactivar → se ocultan; reactivar → vuelven.

---

## Spec coverage

| Spec | Task |
|------|------|
| ensure al activar | 1–2 |
| no duplicar | 1 |
| gate toggle | ya existe + 2 |
| fórmulas | ya existen |
| ocultar al desactivar | ya existe |
