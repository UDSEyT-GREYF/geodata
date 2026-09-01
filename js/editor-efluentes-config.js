// Configuración pública del editor SIGA.
// La clave que debe usarse aquí es la Publishable/anon key de Supabase.
// NUNCA colocar la service_role key en un archivo que se publique en GitHub Pages.

window.SIGA_EDITOR_CONFIG = {
  supabaseUrl: "https://arsmoxqyosomorakzasa.supabase.co",
  supabaseAnonKey: "sb_publishable_rzlL03Rek-M5XUbw-NwXcA_CBNjaKvy",

  airportsSource: "fuentes/Datos_aeropuertos.geojson",
  airportPolygonsSource: "fuentes/poligonos_aeropuertos.geojson"
};
