# Diseño: Descripción en cards + crear desde Ajustes

Fecha: 2026-07-27  
Estado: Aprobado en conversación (pendiente de review del archivo)

## Problema

En Ajustes el usuario puede renombrar y borrar cards, pero no crear una nueva. Además las cards solo tienen nombre: no hay un subtítulo para aclarar para qué sirve cada una.

## Objetivo

1. Poder **crear una card** desde Ajustes (tipo ingreso/egreso — y aporte/retiro si el ahorro está activo —, nombre, descripción opcional).
2. Mostrar la **descripción** como subtítulo debajo del nombre en la grilla del home.
3. Poder **editar nombre y descripción** después desde Ajustes.

## Enfoque elegido

**Reusar el modal “Nueva card”** (mismo del home), ampliado con descripción opcional, y un botón **Agregar card** en Ajustes.

Descartados:

- Formulario inline dentro de Ajustes: el sheet ya es largo.
- Modal único create/edit separado: más trabajo del necesario ahora.

## Experiencia de uso

### Crear desde Ajustes

1. Abrir Ajustes → sección **Tus cards**.
2. Tocá **Agregar card**.
3. Se abre el modal **Nueva card** (Ajustes permanece abierto debajo).
4. Elegí tipo, nombre y descripción opcional → Crear.
5. Se cierra solo el modal de creación; la lista de Ajustes se actualiza.

### Crear desde home

Igual que hoy: botón **Agregar** en la grilla → mismo modal (ahora con descripción).

### Editar en Ajustes

Cada fila de card tiene:

- Input nombre
- Input descripción (placeholder “Opcional”)
- Botón guardar → actualiza nombre y descripción
- Botón borrar (si no es obligatoria; mismas reglas actuales)

### Grilla del home

- Nombre de la card.
- Si `descripcion` no está vacía: subtítulo debajo del nombre.
- Al anotar: el modal sigue mostrando solo el nombre de la card (sin descripción).

## Modelo de datos

Campo nuevo en cada card:

```json
{
  "id": "…",
  "nombre": "Pádel",
  "descripcion": "cancha los martes",
  "tipo": "gasto",
  "obligatoria": false
}
```

- `descripcion`: string opcional; trim; vacío = sin subtítulo.
- Límite de UI: maxlength 60.
- Al normalizar estado: si falta `descripcion`, usar `""`.
- No hace falta subir storage key: `mi-plata-v2` sigue; datos viejos sin el campo siguen andando.
- La descripción **no** se copia a movimientos ni al CSV.

### API de estado

- `crearCard(state, { nombre, tipo, descripcion })` — `descripcion` opcional (default `""`).
- `actualizarCard(state, cardId, { nombre, descripcion })` — reemplaza el uso de `renombrarCard` desde la UI de Ajustes. Nombre obligatorio; descripción opcional (trim; puede quedar vacía). Si cambia el nombre, sincroniza `nombre` en los movimientos de esa card. Si existe `renombrarCard`, puede quedar como wrapper fino o eliminarse si ningún caller externo lo usa.

## Reglas

1. Nombre obligatorio (trim no vacío); descripción opcional.
2. Tipos permitidos: iguales a hoy (`ingreso`/`gasto`; + `aporte`/`retiro` si `ahorroActivo`).
3. Cards obligatorias: se pueden editar nombre y descripción; no se pueden borrar.
4. Cambiar descripción no afecta movimientos.
5. Cambiar nombre sigue actualizando el campo `nombre` de los movimientos de esa card.

## UI

1. **Modal Nueva card** — Tipo, Nombre, Descripción (opcional), Cancelar / Crear.
2. **Ajustes** — botón Agregar card bajo “Tus cards”; filas con nombre + descripción + guardar (+ borrar).
3. **Grilla** — subtítulo solo si hay descripción; estilos mínimos reutilizando tipografía actual.

Mensajes cortos en español rioplatense.

## Fuera de alcance

- Descripción en lista de movimientos, modal anotar o CSV.
- Rediseño visual grande / tipografía nueva.
- Wizard de onboarding.
- Cambios al Excel plantilla.

## Criterios de éxito

- Desde Ajustes se puede crear una card con tipo, nombre y descripción opcional sin perder el contexto de Ajustes.
- Desde home el mismo modal acepta descripción.
- La grilla muestra el subtítulo cuando hay descripción.
- En Ajustes se editan nombre y descripción juntos.
- Datos previos sin `descripcion` cargan sin error.

## Archivos previstos a tocar

- `pwa/state.js` — campo descripción, crear/actualizar, normalización.
- `pwa/state.test.js` — casos crear/actualizar/normalizar.
- `pwa/index.html` — input descripción en modal; botón Agregar en Ajustes; inputs en lista.
- `pwa/app.js` — abrir crear desde Ajustes sin cerrar Ajustes; render grilla/lista; guardar ambos campos.
- `pwa/styles.css` — subtítulo en card y fila de ajustes.
- `pwa/sw.js` — bump de caché si aplica.
