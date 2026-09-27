# Revisión automática de posición LAD

Este módulo NO analiza automáticamente las teselas Esri utilizadas por la página
`lad-control`. Esri World Imagery se mantiene únicamente para la inspección visual
en la interfaz.

## Fuente del análisis automático

Se utiliza la colección:

`CB4A-WPM-PCA-FUSED-1`

del catálogo STAC del INPE. Son imágenes RGB fusionadas de CBERS-4A/WPM con GSD
de 2 m y licencia CC BY 4.0.

El flujo genera dos recortes por LAD:

1. **Contexto**: permite detectar una pista desplazada de la coordenada.
2. **Detalle**: permite comprobar centro, orientación y dimensiones.

La coordenada fuente se dibuja con una cruz roja. La geometría declarada
(RWY / dimensiones) se dibuja en amarillo como referencia y nunca se considera
evidencia por sí sola.

## Resultado

`data/lad-control/lad_revision_automatica.csv`

Campos principales:

- `auto_estado`: compatible / revisar / no_evaluable
- `auto_confianza`: 0–1
- `auto_prioridad`: alta / media / baja
- `auto_instalacion_visible`
- `auto_centro_coincide`
- `auto_orientacion_compatible`
- `auto_dimension_compatible`
- `auto_observacion`
- escena y fecha de la imagen analizada

La automatización NO modifica coordenadas. Sólo prioriza los casos que requieren
revisión humana.

## Primera prueba recomendada

Ejecutar primero:

- Registro 451 · EA. EL CENCERRO
- Registro 2330 · LADH LIGA IGUAZU

Después ejecutar una muestra de 20 LAD. Sólo si el criterio resulta satisfactorio,
procesar los 892.

## Opción A — GitHub Actions

Copiar al repositorio:

- `.github/workflows/lad-auto-review.yml`
- `scripts/lad_auto/common.py`
- `scripts/lad_auto/inventariar_cbers.py`
- `scripts/lad_auto/revisar_imagenes.py`
- `requirements-lad-auto.txt`
- `data/lad-control/lad_revision_automatica.csv`

### 1. Inventario sin IA

En GitHub:

Actions → `LAD - revisión automática` → Run workflow

- modo: `inventario`
- límite: `20`

No requiere clave de OpenAI.

### 2. Configurar análisis visual

La API de OpenAI requiere una clave propia. Guardarla en:

Settings → Secrets and variables → Actions → New repository secret

Nombre:

`OPENAI_API_KEY`

No escribir la clave en ningún archivo del repositorio.

### 3. Probar un registro

Actions → LAD - revisión automática

- modo: `analisis`
- registro: `451`
- límite: `0`

Luego repetir con `2330`.

### 4. Muestra

- modo: `analisis`
- registro: vacío
- límite: `20`
- sólo pendientes: sí

### 5. Total

Cuando la muestra haya sido validada:

- modo: `analisis`
- límite: `0`
- sólo pendientes: sí

## Opción B — PC local

Instalar:

`pip install -r requirements-lad-auto.txt`

Inventario:

`python scripts/lad_auto/inventariar_cbers.py --limit 20`

Análisis:

`python scripts/lad_auto/revisar_imagenes.py --registro 451`

Debe existir la variable de entorno `OPENAI_API_KEY`.

## Nota metodológica

El resultado automático debe tratarse como un filtro de control de calidad.
No reemplaza la verificación oficial ni debe corregir automáticamente el KML fuente.

Los casos `revisar` y `no_evaluable` son los que conviene abrir posteriormente en
`/geodata/lad-control/`.
