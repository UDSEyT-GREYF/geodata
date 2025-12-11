// Cuando el iframe cargue ocultamos el mensaje
document.addEventListener("DOMContentLoaded", () => {
  const iframe = document.getElementById("pbiFrame");
  const msg = document.getElementById("msg");

  if (!iframe) return;

  iframe.onload = () => {
    iframe.style.display = "block";
    if (msg) {
      msg.style.display = "none";
    }
  };
});
