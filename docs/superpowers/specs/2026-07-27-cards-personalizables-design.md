# Diseño: Cards personalizables (ingresos, egresos y ahorro opcional)

Fecha: 2026-07-27  
Estado: Aprobado en conversación (pendiente de review del archivo)

## Problema

La PWA actual (“Mis gastos”) permite anotar ingresos, egresos y ahorro, pero las categorías vienen fijas en el código (Pádel, Facultad, Transporte, etc.). El usuario necesita armar sus propias cards con los nombres que quiera, sin perder la simplicidad de anotar en pocos toques.

## Objetivo

Que el usuario pueda:

1. Tener siempre al menos una card de **ingreso** y una de **egreso**, con nombres que él elige.
2. Agregar todas las cards extras que necesite.
3. Anotar monto + nota opcional tocando una card.
4. Activar **ahorro** solo si lo quiere, desde Ajustes.
5. Entender el flujo sin instrucciones largas.

## Enfoque elegido

**Cards propias + anotar rápido** (sobre la PWA existente en `pwa/`).

Descartados:

- Anotar sin cards fijas (tipo + nombre + monto cada vez): más pasos.
- Pantallas por tipo con listas anidadas: más complejo de lo necesario.

## Experiencia de uso

### Pantalla principal

- Fecha del día.
- Plata disponible.
- Totales: cobrado / gastado; ahorrado solo si el ahorro está activo.
- Grilla de cards del usuario + botón **Agregar**.
- Lista de últimos movimientos (borrar; editar solo el monto).

### Primera vez

1. La app crea **2 cards obligatorias**: 1 ingreso y 1 egreso, con nombres por defecto **“Ingreso”** y **“Egreso”**.
2. El usuario las renombra cuando quiera desde Ajustes o con una acción clara en la card (sin wizard obligatorio al abrir).
3. No puede quedar con menos de esas dos: **no se pueden borrar**.

### Crear card

1. Tocá **Agregar**.
2. Elegí tipo: Ingreso o Egreso. Si el ahorro está activo, también Aporte / Retiro (o equivalentes claros en español).
3. Escribí el nombre.
4. La card queda en la grilla.

### Anotar movimiento

1. Tocá una card.
2. Ingresá monto (obligatorio) y nota opcional.
3. Guardar → actualiza saldos y aparece en la lista.

### Editar movimiento

- Solo se puede cambiar el **monto**.
- El nombre mostrado sigue siendo el de la card (+ nota si tiene).

### Ajustes

- Saldo inicial.
- Activar / desactivar ahorro (+ saldo inicial de ahorro si aplica).
- Renombrar cards.
- Borrar cards **no obligatorias** (solo si no tienen movimientos).
- Exportar CSV.

## Modelo de datos

Storage key: subir a `mi-plata-v2` (o migrar desde `mi-plata-v1`).

```json
{
  "saldoInicial": 0,
  "ahorroActivo": false,
  "saldoAhorroInicial": 0,
  "cards": [
    {
      "id": "card-ingreso-base",
      "nombre": "Ingreso",
      "tipo": "ingreso",
      "obligatoria": true
    },
    {
      "id": "card-egreso-base",
      "nombre": "Egreso",
      "tipo": "gasto",
      "obligatoria": true
    }
  ],
  "movimientos": [
    {
      "id": "…",
      "cardId": "card-egreso-base",
      "nombre": "Egreso",
      "nota": "almuerzo",
      "tipo": "gasto",
      "monto": 2500,
      "fechaISO": "2026-07-27",
      "createdAt": 0
    }
  ]
}
```

### Tipos

- `ingreso`: suma a disponible.
- `gasto`: resta de disponible.
- `aporte`: resta de disponible, suma a ahorro (solo si `ahorroActivo`).
- `retiro`: suma a disponible, resta de ahorro (solo si `ahorroActivo`).

### Fórmulas

- `disponible = saldoInicial + ingresos - gastos - aportes + retiros`
- `ahorrado = saldoAhorroInicial + aportes - retiros` (solo visible si ahorro activo)

## Reglas

1. Siempre existen ≥ 1 card `ingreso` y ≥ 1 card `gasto` con `obligatoria: true`.
2. Cards obligatorias: se pueden renombrar; no se pueden borrar.
3. Cards extras: renombrar y borrar (borrar bloqueado si tienen movimientos; pedir borrar movimientos primero o avisar).
4. Renombrar card: actualiza `nombre` de la card y el campo `nombre` de sus movimientos existentes (la nota no cambia).
5. Con ahorro desactivado: ocultar totales de ahorro y cards de tipo `aporte`/`retiro`; no permitir crear nuevas de esos tipos. Los movimientos de ahorro previos se conservan en storage y siguen entrando en el cálculo de `disponible` (aportes restan, retiros suman). Al reactivar el ahorro, vuelven a verse cards y total ahorrado.
6. Monto de movimiento: número finito > 0.
7. Nota: string opcional, trim; vacío = sin nota.

## UI / modales

1. **Home** — saldo, grilla, movimientos.
2. **Modal anotar** — título = nombre de la card; input monto; input nota opcional; Guardar.
3. **Modal crear card** — tipo + nombre.
4. **Modal editar monto** — al tocar un movimiento (o acción clara “Editar”); solo monto.
5. **Modal ajustes** — saldos, toggle ahorro, lista de cards (renombrar/borrar), exportar.

Mensajes cortos y en español rioplatense, alineados al tono actual de la app.

## Migración desde v1

Si existe `mi-plata-v1`:

1. Leer `saldoInicial`, `saldoAhorroInicial` y `movimientos`.
2. Crear cards obligatorias base: ingreso “Ingreso”, egreso “Egreso”.
3. Por cada `categoriaId` distinto en movimientos, crear una card extra con el `nombre` y `tipo` del primer movimiento de esa categoría (`obligatoria: false`). Si el id era `cobre` o `otros`/gastos fijos, igual se crean como extras (no se fusionan a la base) para no perder el nombre histórico (Pádel, etc.).
4. Si hay algún movimiento `aporte` o `retiro`, setear `ahorroActivo: true`.
5. Reasignar cada movimiento a su `cardId`; conservar `nombre`; `nota` = `""`.
6. Guardar en `mi-plata-v2` y borrar `mi-plata-v1`.

Si no hay datos previos: estado default con 2 cards obligatorias, `ahorroActivo: false` y listas vacías.

## Fuera de alcance

- Cuentas bancarias, presupuestos, gráficos, nube, login, multi-dispositivo.
- Editar la nota de un movimiento ya guardado (solo monto).
- Excel plantilla (`generar_plantilla.js`): no es parte de este cambio salvo que se pida después.
- Cambiar tipografía / rediseño visual grande: reutilizar estilos actuales.

## Criterios de éxito

- Primera apertura: se ven 2 cards (ingreso + egreso), renombrables, no borrables.
- El usuario puede agregar más cards y anotar monto + nota opcional en 2–3 toques.
- Ahorro apagado por defecto; al activarlo aparecen opciones de aporte/retiro.
- Editar movimiento = solo monto; borrar funciona.
- Export CSV incluye fecha, tipo, nombre, nota, monto.
- Datos persisten al recargar; migración desde v1 no pierde movimientos.

## Archivos previstos a tocar

- `pwa/index.html` — grilla dinámica, modales nuevos, toggle ahorro.
- `pwa/app.js` — estado con cards, CRUD, anotar, editar monto, migración.
- `pwa/styles.css` — estilos mínimos para nota, agregar card, lista en ajustes.
- `pwa/sw.js` — bump de caché si hace falta.
- `README.md` — actualizar “cómo usarla”.
