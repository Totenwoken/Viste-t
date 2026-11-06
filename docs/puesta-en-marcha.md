# Puesta en marcha de Viste-t

Se hace una sola vez. Calcula una hora. Necesitas tres cuentas gratuitas (Supabase, Vercel, GitHub) y una de pago por uso (Anthropic).

## 1. Supabase: base de datos y fotos

1. Entra en <https://supabase.com>, crea una cuenta y un **proyecto nuevo** (plan Free, región **EU (Frankfurt o Irlanda)**). Guarda la contraseña de la base de datos en un lugar seguro.
2. En el proyecto, abre **SQL Editor → New query**, pega todo el contenido de [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) y pulsa **Run**. Debe terminar sin errores.
3. Comprueba en **Storage** que existe el bucket `garments` y que es **privado**.
4. En **Project Settings → API** copia:
   - **Project URL** → será `SUPABASE_URL`
   - **service_role** (secret) → será `SUPABASE_SERVICE_ROLE_KEY`. **No la compartas con nadie**: da acceso total a tus datos.

## 2. Anthropic: la clave de Claude

1. Entra en <https://console.anthropic.com> y crea una cuenta. Va aparte de tu suscripción de Claude.
2. En **Billing**, carga saldo (con 5–10 $ tienes para meses).
3. En **Billing → Limits**, fija un **límite de gasto mensual**, por ejemplo 10 $. Es una segunda red de seguridad además del tope de la app.
4. En **API Keys**, crea una clave llamada `viste-t` y cópiala → será `ANTHROPIC_API_KEY`.

## 3. GitHub: el código

1. Crea un repositorio nuevo llamado `viste-t`.
   - **Público** si mantenemos el quitafondos actual (su licencia AGPL obliga a ofrecer el código). Tus fotos y datos no se ven: solo el código.
   - Si lo prefieres **privado**, avísame antes y cambio el quitafondos.
2. Sube el código (te doy los comandos exactos cuando llegues a este punto).

## 4. Vercel: publicar la app

1. Entra en <https://vercel.com> con tu cuenta de GitHub.
2. **Add New → Project**, elige el repositorio `viste-t` y deja la configuración que detecta (Vite).
3. Antes de desplegar, en **Environment Variables** añade:

| Variable | Valor |
|---|---|
| `ACCESS_CODE` | El código que quieras usar para entrar (algo que no sea fácil de adivinar) |
| `ANTHROPIC_API_KEY` | La clave del paso 2 |
| `SUPABASE_URL` | La Project URL del paso 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | La service_role del paso 1 |
| `OWNER_USER_ID` | Un identificador fijo. Genera uno en <https://www.uuidgenerator.net/version4> y no lo cambies nunca |
| `MODEL_TAGGING` | `claude-haiku-5-5` |
| `MONTHLY_BUDGET_USD` | `5` |

4. Pulsa **Deploy**. Al terminar tendrás una dirección del tipo `https://viste-t.vercel.app`.

## 5. Prueba en el móvil

1. Abre la dirección en el móvil, introduce tu código y añade la app a la pantalla de inicio:
   - iPhone (Safari): botón Compartir → **Añadir a pantalla de inicio**
   - Android (Chrome): menú ⋮ → **Instalar aplicación**
2. En **Armario → Añadir prendas**, sube 5–10 fotos reales (una prenda por foto, buena luz).
   - La primera vez tarda más, porque descarga el modelo que quita el fondo.
3. Cierra la app a mitad de la subida y vuelve a abrirla. Debe seguir donde lo dejó, sin duplicar prendas.
4. Revisa las fichas: toca una prenda, corrige lo que esté mal, márcala como "En la lavandería" y vincula un traje (chaqueta + pantalón).
5. En Supabase, en **Table Editor → usage_ledger**, comprueba que el gasto es de céntimos.

### Si algo falla

- **"Código incorrecto"**: revisa `ACCESS_CODE` en Vercel (y vuelve a desplegar tras cambiarla).
- **Las fotos se quedan en "Reintentar" al subir**: avísame. Puede que Supabase pida una cabecera extra para la subida; es un ajuste pequeño.
- **Las fichas salen flojas**: en Vercel cambia `MODEL_TAGGING` a `claude-sonnet-5-5`, vuelve a desplegar y reintenta. Cuesta más, pero es más preciso.
