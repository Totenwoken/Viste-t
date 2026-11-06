# Viste-t — Diseño (v1)

Fecha: 2026-11-06 · Autor: Alejandro (con Claude)

## 1. Intención y por qué

Alejandro quiere una app en el móvil que le diga qué ponerse usando **solo la ropa que ya tiene en su vestidor**, siguiendo **su estilo** (definido a partir de looks de Instagram que le gustan) y que **aprenda de sus decisiones** con el uso. También quiere usarla **en tiendas**: fotografiar una prenda y saber con qué de su armario combina y si merece la pena comprarla.

Uso: personal. Posiblemente se la enseñe a amigos y, si hay interés, se abra a más gente **gratis**. La v1 no tiene que ser multiusuario, pero no debe impedirlo.

## 2. Objetivos, no objetivos, anti-objetivos

**Objetivos (v1)**
- Digitalizar un armario de **más de 100 prendas** con el menor esfuerzo posible (subida por lotes, fichas automáticas, revisión rápida).
- Generar conjuntos completos (incluido el calzado) con 1 toque, por estilo o alrededor de prendas concretas.
- Modo Tienda: foto de una prenda, conjuntos con su armario y veredicto de compra.
- Perfil de estilo derivado de capturas de Instagram, legible y editable.
- Aprender de "Me lo pongo" y "Otro" (con motivo opcional).
- Funcionar como app instalada en el móvil (iPhone y Android).

**No objetivos (v1)**
- Avatar y probador virtual con fotos suyas → **v2.0**.
- Leer Instagram automáticamente (no está permitido; se usan capturas).
- Publicar en App Store o Google Play.
- Registro abierto de usuarios, red social, compartir looks.

**Anti-objetivos (sería un fracaso aunque funcione)**
- Que cargar el armario sea tan pesado que no llegue a terminarlo.
- Conjuntos genéricos que ignoran su estilo, o que incluyen prendas que **no tiene**.
- Perder el armario (cambio de móvil, borrado del navegador).
- Que la clave de la API quede expuesta y cualquiera pueda gastar a su cargo.
- Repetir siempre las mismas combinaciones.

## 3. Restricciones

- **Coste**: gratis en infraestructura (planes gratuitos). El único coste variable es la API de Claude por uso. Debe ser bajo y conviene poder estimarlo.
- **Móvil primero**: todo se usa con una mano y con la cámara del móvil.
- **Idioma**: interfaz en español.
- **Seguridad**: la clave de Claude y las credenciales de la base de datos **nunca** llegan al navegador.
- **Acceso**: la app pide un **código de acceso** para entrar. Sin código no se puede usar ni gastar consultas.

## 4. Enfoques considerados

| Enfoque | Ventajas | Inconvenientes |
|---|---|---|
| **A. App web instalable (PWA) + funciones en servidor** ✅ elegida | Una sola versión para iPhone y Android, sin tiendas, se comparte con un enlace, iteración rápida | Requiere un servidor pequeño para ocultar la clave; la cámara es algo menos fluida que en nativo |
| B. App nativa (React Native/Expo) | Cámara y sensación 100% nativas | 99 €/año en Apple, publicar para compartir, iteración lenta |
| C. Proyecto de Claude sin app | Funciona ya, sin programar | Sin armario visual, modo tienda incómodo, no se puede compartir |

**Elegida: A**, porque cubre el móvil, el compartir gratis y la apertura futura sin rehacer nada.

## 5. Lo decidido

### 5.1 Arquitectura
- **Código en GitHub**, despliegue automático en **Vercel** (plan gratuito).
- **Frontend**: PWA instalable (icono en la pantalla de inicio, a pantalla completa).
- **Funciones de servidor en Vercel**: único sitio que conoce la clave de Claude y las credenciales de Supabase. Comprueban el código de acceso en cada petición.
- **Supabase (plan gratuito)** desde el primer día: base de datos para fichas, conjuntos, feedback y perfil de estilo, y almacenamiento para las fotos. Así hay copia de seguridad, acceso desde otro dispositivo y camino abierto a multiusuario.
- **Claude (visión)** para: rellenar la ficha de cada prenda, analizar las capturas de estilo, generar conjuntos, explicar por qué combinan y el veredicto de compra.

### 5.2 Navegación
Barra inferior fija: **Armario · Inicio · Tienda · Estilo**.

### 5.3 Inicio (boceto A aprobado)
```
Jueves, 6 nov · 14°C ☁️
Hola, Alejandro
┌─────────────────────────┐
│   ¿Qué me pongo hoy?    │  ← botón principal: conjunto automático
└─────────────────────────┘
[👖 Vaqueros]  [👔 Formal]
[🤵 Formal traje] [Chinos]
( ✏️ Quiero ponerme… camiseta básica blanca  → )
──────────────────────────
Armario · Inicio · Tienda · Estilo
```
- **Fecha y tiempo del día** arriba; el tiempo se tiene en cuenta al generar.
- **Botón principal**: conjunto automático según estilo, tiempo e historial.
- **4 estilos** (iterables más adelante):
  - *Vaqueros*: pantalón vaquero + camiseta o camisa, jersey opcional.
  - *Formal*: cualquier pantalón + camisa, jersey opcional.
  - *Formal traje*: lo más formal (reuniones, consejos, visitas).
  - *Chinos*: pantalón no vaquero + camisa o camiseta, jersey opcional.
- **Barra de texto "Quiero ponerme…"**: una o varias prendas en lenguaje natural ("camiseta básica blanca", "zapatillas marrones"). El conjunto se monta alrededor de ellas, buscándolas en su armario.

### 5.4 Resultado (aprobado)
- **El conjunto se muestra como una sola imagen**: un collage tipo "flat lay" con las fotos (sin fondo) de sus prendas: abrigo si toca, prenda de arriba, de abajo, calzado y complementos si los hay. **Lo compone la app** con sus fotos, no Claude, así que no tiene coste de API y se rehace al instante. Se puede guardar o compartir como imagen.
- Una frase corta explicando por qué combina.
- **"Me lo pongo ✓"**: registra el conjunto como usado hoy y como positivo.
- **"Otro ↻"**: genera otro y registra el rechazo. Motivo opcional con 1 toque: *muy formal · muy informal · colores · me lo puse hace poco · no me apetece esa prenda*.
- **Candado 🔒 por prenda**: las prendas pedidas en "Quiero ponerme…" salen **bloqueadas** por defecto, y él puede bloquear cualquier otra. "Otro" **mantiene las bloqueadas** y cambia el resto.
- **Tocar una prenda → "Cambiar solo esta"**: sustituye esa prenda sin tocar las demás. El rechazo se registra **a nivel de prenda** (dentro de ese conjunto).
- **"Me puse otra cosa"**: permite registrar lo que se puso realmente si difiere de la propuesta.

### 5.5 Armario
- **Una foto por prenda**, colgada o extendida; desde la cámara o la galería.
- **Carga por lotes**: selecciona muchas fotos de golpe, se procesan en segundo plano y al final se revisa una lista para corregir solo lo que esté mal. Se puede hacer en varias tandas; lo subido se conserva.
- **Quitar el fondo** de cada foto para que se vea limpia.
- **Ficha automática** con Claude: tipo/categoría, color(es), formalidad, estación, más lo que el constructor considere útil para combinar. Editable.
- Incluye **calzado**, **prendas de abrigo** (abrigo, cazadora, americana; se añaden cuando el tiempo lo pide) y, opcionalmente, **complementos** (cinturón, reloj, gorra…).
- **Trajes**: chaqueta y pantalón se guardan como dos prendas **vinculadas**. En "Formal traje" salen siempre juntas; en otros estilos la chaqueta solo se usa suelta si está marcada como "combinable".
- **Disponibilidad**: cada prenda puede marcarse como *disponible · en la lavandería · guardada (fuera de temporada)*, con un toque. Las no disponibles no se usan en conjuntos ni cuentan en el veredicto de compra (las guardadas sí cuentan como "ya lo tengo").
- **Procesado de la carga**: ocurre mientras la app está abierta. Si se cierra a mitad, las fotos pendientes se retoman al volver a abrirla. No hace falta procesado con la app cerrada.

### 5.6 Tienda
- Foto de una prenda en la tienda.
- **2–3 conjuntos** con esa prenda y ropa de su armario.
- **Veredicto de compra**: con cuántas de sus prendas combina, si duplica algo que ya tiene y si cubre un hueco del armario.
- Botón **"La he comprado"**: la añade al Armario con esa foto y su ficha.

### 5.7 Estilo
- Sube **capturas de Instagram** y, opcionalmente, una lista de cuentas como texto.
- Claude genera un **perfil de estilo escrito** (colores, siluetas, prendas típicas…), **legible y editable**.
- Las capturas se pueden **asociar a cada uno de los 4 estilos**, para que cada botón se inspire en sus propias referencias.

### 5.8 Aprendizaje
Sin entrenar modelos. Cada petición de conjunto incluye como contexto:
- el perfil de estilo (y las referencias del estilo pedido);
- conjuntos aceptados y rechazados, con sus motivos;
- lo que se ha puesto en los últimos días (para no repetir);
- el tiempo de hoy.

Restricción dura: el conjunto **solo** puede usar prendas que existan en su armario (validarlo en el servidor).

## 6. Decisiones de Claude (revisables)

- Supabase guarda **todo** (fotos y datos). Las funciones de Vercel acceden con credenciales de servidor; el navegador nunca habla directamente con Supabase en la v1.
- Las tablas incluyen `user_id` desde el principio, aunque en la v1 haya un único usuario, para que abrir a amigos (con Supabase Auth) no obligue a migrar.
- Código de acceso: un secreto en variables de entorno de Vercel. Se introduce una vez y el móvil lo recuerda.
- Tiempo: un servicio gratuito sin clave (p. ej. Open-Meteo) con la ubicación del móvil, o una ciudad fija si no se da permiso.
- Las fotos se comprimen en el móvil antes de subirlas (para el almacenamiento gratuito y para abaratar las llamadas a Claude).
- **Modelo (decidido con Alejandro)**: **Claude Haiku 5.5 (`claude-haiku-5-5`) para todo** por defecto, priorizando coste mínimo. Coste estimado: ~0,25–0,50 $/mes de uso normal y ~0,05 $ una sola vez para fichar el armario. En la fase de pruebas se valida la calidad de cada tarea (ficha de prenda, conjuntos, Tienda/veredicto, perfil de estilo). La que salga floja sube **solo esa** a Claude Sonnet 5.5 (`claude-sonnet-5-5`). El modelo de cada tarea es **configurable** (variable de entorno o ajuste), sin tocar código. Descartados otros proveedores: el ahorro frente a Haiku sería de céntimos y añade otra cuenta y otra integración.
- **Facturación de la API**: va aparte de su suscripción de Claude (cuenta en console.anthropic.com con saldo prepagado).
- **Tope de gasto**: 5 $/mes por defecto, editable en Ajustes. Al alcanzarlo, la app deja de llamar a Claude hasta el mes siguiente y lo avisa. El gasto se calcula en el servidor con el `usage` de cada respuesta.
- **Qué recibe Claude al generar conjuntos**: las **fichas en texto** del armario (no las fotos), más el perfil de estilo, el feedback y el tiempo. Las fotos solo se envían a Claude al fichar una prenda, en el modo Tienda (la foto de la tienda) y al analizar las capturas de estilo (una vez, para escribir el perfil). La parte estable (armario y perfil) va en caché para abaratar.

## 7. Lo que queda al constructor

- Framework del frontend y librerías de la PWA.
- Cómo quitar el fondo (en el navegador o con un servicio), siempre que sea gratis o casi gratis y con calidad aceptable.
- Esquema exacto de la ficha de prenda y de las tablas.
- Formato de los prompts, nivel de esfuerzo (effort) por tarea y uso de salidas estructuradas.
- Diseño concreto del collage (disposición, fondo), dentro de lo aprobado.
- Medir el coste real por acción en las pruebas y ajustar si se aleja de la estimación.
- Pantallas secundarias: detalle y edición de prenda, historial, ajustes (código, ciudad).

## 8. v2.0 (fuera de alcance)
- Avatar generado a partir de fotos suyas y probador virtual de prendas.
