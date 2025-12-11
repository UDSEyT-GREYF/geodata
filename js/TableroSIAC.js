// Redirección automática al tablero interno (si la red lo permite)
document.addEventListener("DOMContentLoaded", () => {
  const target = "http://rpserver/PBIReports/powerbi/GREF_2024/SIAC_ANAC_ORSNA_v3?rs:Embed=true";

  // Pequeño delay para que se vea algo de contenido si falla
  setTimeout(() => {
    window.location.href = target;
  }, 500);
});
