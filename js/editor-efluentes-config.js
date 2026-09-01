// Configuración pública del editor SIGA.
// La clave que debe usarse aquí es la Publishable/anon key de Supabase.
// NUNCA colocar la service_role key en un archivo que se publique en GitHub Pages.

window.SIGA_EDITOR_CONFIG = {
  supabaseUrl: "PEGAR_AQUI_PROJECT_URL",
  supabaseAnonKey: "PEGAR_AQUI_PUBLISHABLE_O_ANON_KEY",

  // Fuentes ya utilizadas por SIGA en el repositorio geodata.
  airportsSource: "fuentes/Datos_aeropuertos.geojson",
  airportPolygonsSource: "fuentes/poligonos_aeropuertos.geojson"
};
