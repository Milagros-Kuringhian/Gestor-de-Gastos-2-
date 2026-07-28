# Diseño: Cards de ahorro al activar el modo en Ajustes

Fecha: 2026-07-27  
Estado: Aprobado en conversación (pendiente de review del archivo)

## Problema

El usuario quiere anotar aportes y retiros de ahorro desde el inicio, ver el total **Ahorrado** en la balance-card (aparte de Cobrado/Gastado), y que esos montos **no cuenten como gasto**. Hoy el toggle **Usar ahorro** en Ajustes existe y la lógica de `aporte`/`retiro` ya calcula bien, pero al activar el modo **no se crean cards** de ahorro automáticamente: el usuario queda sin botones visibles en Anotar salvo que cree cards a mano.

## Objetivo

1. Con **Usar ahorro** activado y guardado: en el inicio aparecen cards para **meter** y **sacar** ahorro, y en la balance-card se muestra **Ahorrado**.
2. Con el modo **apagado**: no se ven esas cards ni la fila Ahorrado.
3. Un aporte baja Disponible y suma a Ahorrado; **no** incrementa Gastado. Un retiro hace lo inverso.

## Enfoque elegido

**Asegurar cards de ahorro al activar el toggle** (sobre la PWA existente).

Al guardar Ajustes con `ahorroActivo: true`, garantizar que existan al menos:

- una card tipo `aporte` (nombre por defecto: “Aporte a ahorro”)
- una card tipo `retiro` (nombre por defecto: “Retiro de ahorro”)

Si ya existen cards de esos tipos (creadas por el usuario o por una activación previa), no duplicar.

Descartados:

- Ahorro siempre visible sin toggle: el usuario pidió que solo se vea si activa el modo en Ajustes.
- Una sola card “Ahorro” con elección Meter/Sacar en el modal: más pasos y cambio de UX innecesario; ya hay tipos `aporte` y `retiro`.

## Experiencia de uso

### Ajustes

1. Tocá **Usar ahorro**.
2. (Opcional) Completá saldo inicial de ahorro.
3. **Guardar**.
4. Si faltaban, se crean las dos cards base de ahorro.

Al desactivar y guardar: las cards de aporte/retiro se **ocultan** en el inicio (siguen en storage; no se borran movimientos).

### Inicio con ahorro activo

- Balance-card: Disponible + fila Cobrado / Gastado / **Ahorrado**.
- Anotar: cards de aporte y retiro visibles; el usuario elige cuál tocar e ingresa el monto (+ nota opcional).
- Historial: movimientos de ahorro con estilo de ahorro (no como gasto).

### Inicio con ahorro off

- Sin fila Ahorrado.
- Sin cards aporte/retiro en la grilla.
- No se pueden crear cards de esos tipos desde “Agregar card”.

## Modelo de datos

Sin cambio de schema. Reutilizar:

- `ahorroActivo`, `saldoAhorroInicial`
- cards `tipo: "aporte" | "retiro"`
- fórmulas ya definidas en la spec de cards personalizables:

  - `disponible = saldoInicial + ingresos - gastos - aportes + retiros`
  - `ahorrado = saldoAhorroInicial + aportes - retiros`

IDs sugeridos para las cards base (estables, idempotentes):

- `card-aporte-base`
- `card-retiro-base`

`obligatoria: false` (o `true` solo mientras el producto decida bloquear borrado; por defecto: no son obligatorias como ingreso/egreso, pero `ensureAhorroCards` las recrea al reactivar si faltan).

## Reglas

1. Gate: UI de ahorro en inicio solo si `ahorroActivo === true` (comportamiento actual de `visibleCards` + `#ahorro-total-wrap`).
2. Al persistir estado con `ahorroActivo: true`, llamar `ensureAhorroCards(state)` antes de guardar/render.
3. `ensureAhorroCards`: si no hay ninguna card `aporte`, agregar `card-aporte-base`; si no hay ninguna `retiro`, agregar `card-retiro-base`. No tocar cards de ahorro ya existentes con otros ids/nombres.
4. Aporte no entra en `gastado`; retiro no entra en `cobrado` (ya cubierto por `totales`).
5. Mensajes y tonos: español rioplatense, alineado a la app.

## Fuera de alcance

- Quitar el toggle de Ajustes o activar ahorro por defecto.
- Rediseño visual grande de la balance-card.
- Editar nota de movimientos; presupuestos; multi-cuenta.

## Criterios de éxito

- Con ahorro off: inicio sin Ahorrado ni cards de ahorro.
- Activar toggle → Guardar → en Anotar se ven Aporte y Retiro; balance muestra Ahorrado.
- Anotar aporte: Disponible baja, Ahorrado sube, Gastado no cambia por ese monto.
- Anotar retiro: Disponible sube, Ahorrado baja.
- Desactivar toggle → Guardar → cards y Ahorrado desaparecen del inicio; datos conservados.
- Reactivar → vuelven a verse (y se recrean bases si el usuario las había borrado).

## Archivos previstos a tocar

- `pwa/state.js` — `ensureAhorroCards` (+ tests).
- `pwa/app.js` — invocar al guardar saldos / al cargar si `ahorroActivo`.
- `pwa/state.test.js` — casos de ensure / no duplicar.
- `pwa/sw.js` — bump de caché si hace falta.
- Spec previa de cards: este doc la complementa; no la reemplaza.
