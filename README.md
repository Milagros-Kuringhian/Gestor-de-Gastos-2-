# Mis gastos — gestor de gastos

Dos formas de usarlo:

1. **PWA (recomendada en el celular)** → carpeta `pwa/`
2. **Excel** → `Gestor_Gastos.xlsx` (opcional, en la compu)

## PWA: anotar desde el celular

App instalable en Android. Anotás en 2 toques (categoría → monto). Los datos quedan en el celular. Podés exportar CSV de respaldo.

### Probar en la compu

```bash
npm run pwa
```

Abrí `http://localhost:4173` en Chrome.

### Publicar (necesario para instalar en el celular)

La PWA necesita HTTPS. Lo más fácil es **Vercel**:

1. Creá cuenta gratis en [vercel.com](https://vercel.com)
2. Instalá Vercel CLI o subí la carpeta `pwa` desde la web
3. En la terminal, desde este proyecto:

```bash
npx vercel pwa --yes
```

4. Te va a dar una URL tipo `https://....vercel.app`

### Instalar en Android

1. Abrí esa URL en **Chrome** del celular
2. Menú ⋮ → **Instalar app** o **Agregar a la pantalla principal**
3. Queda el ícono **Mis gastos**

### Cómo usarla

1. Arrancás con dos cards: **Ingreso** y **Egreso** (renombrables en Ajustes; no se borran).
2. Tocá **Agregar** para crear más cards con el nombre que quieras.
3. Tocá una card → monto + nota opcional → Guardar.
4. En la lista podés **Editar** el monto o **Borrar**.
5. **Ajustes** → saldo inicial; opcionalmente activá **Usar ahorro**.
6. **Exportar CSV** cuando quieras un respaldo.

## Excel (opcional)

```bash
npm run generar
```

Genera `Gestor_Gastos.xlsx` con la hoja **Diario** (una fila por día, columnas fijas).
