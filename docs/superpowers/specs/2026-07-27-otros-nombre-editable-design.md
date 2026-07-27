# Diseño: Nombre editable en categoría Otros

Fecha: 2026-07-27  
Estado: Aprobado por el usuario (opción A)

## Problema

Al tocar el botón **Otros**, el movimiento se guarda siempre con nombre `"Otros"`. El usuario quiere poder ponerle un nombre personalizado al gasto, manteniendo el mismo flujo de modal actual (categoría → monto → Guardar).

## Solución elegida (opción A)

En el modal de monto, el título se convierte en un campo editable **solo** cuando la categoría activa es `otros`. En el resto de categorías el título sigue siendo texto estático.

## Flujo

1. Usuario toca **Otros**.
2. Se abre el mismo modal de monto.
3. El título es un input editable con placeholder `Nombre del gasto` y valor inicial vacío.
4. Usuario escribe el nombre deseado.
5. Usuario ingresa el monto (igual que hoy).
6. Al Guardar: se crea el movimiento con `categoriaId: "otros"` y `nombre` = texto del input (trim). Si queda vacío, fallback `"Otros"`.
7. En **Últimos movimientos** y en el CSV se muestra ese nombre.

## Cambios técnicos

### HTML (`pwa/index.html`)

- Mantener `#modal-titulo` como título estático.
- Agregar `#input-nombre-otros` (input de texto), oculto por defecto, con estilos de título.
- Al abrir Otros: ocultar título estático, mostrar input.
- Al abrir otras categorías: mostrar título, ocultar input.

### JS (`pwa/app.js`)

- En `abrirModalMonto(cat)`: si `cat.id === "otros"`, mostrar el input de nombre, limpiarlo y enfocarlo. Si no, comportamiento actual (título con `cat.nombre`, foco en monto).
- En `guardarMovimiento()`: si la categoría es otros, `nombre = inputNombre.value.trim() || "Otros"`; si no, `categoriaActiva.nombre` como hoy.
- Validación de monto sin cambios.
- No cambiar la estructura de storage (`mi-plata-v1`); el campo `nombre` ya existe en cada movimiento.

### CSS (`pwa/styles.css`)

- Estilos para que el input de nombre se vea como el título del modal (misma tipografía/tamaño), borde sutil o underline, ancho completo.

## Fuera de alcance

- Renombrar movimientos ya guardados.
- Crear categorías nuevas permanentes.
- Cambiar el comportamiento de otras categorías.

## Criterios de éxito

- Tocar Otros → poder escribir nombre + monto.
- Guardar → el movimiento aparece en la lista con ese nombre y el monto correspondiente.
- Otras categorías sin cambio de UX.
- Nombre vacío → se guarda como `"Otros"`.
