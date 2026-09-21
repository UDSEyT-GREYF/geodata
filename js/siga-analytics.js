// SIGA / GEODATA - Analítica anónima de uso
// Registra páginas y eventos en Supabase sin guardar nombre, email ni IP en la tabla.
// Versión: 2026-09-21

(() => {
  "use strict";

  const SUPABASE_URL = "https://arsmoxqyosomorakzasa.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rzlL03Rek-M5XUbw-NwXcA_CBNjaKvy";
  const RPC_URL = `${SUPABASE_URL}/rest/v1/rpc/log_geodata_event`;
  const PRODUCTION_HOST = "udseyt-greyf.github.io";
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

  // Evita contaminar las estadísticas con aperturas locales o previews.
  const isProduction = window.location.hostname === PRODUCTION_HOST;

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    // Fallback para navegadores antiguos.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  let memoryVisitorId = null;
  let memorySessionId = null;
  let memorySessionActivity = 0;

  function getVisitorId() {
    let id = safeStorageGet("siga_visitor_id");

    if (!id) {
      id = memoryVisitorId || uuid();
      memoryVisitorId = id;
      safeStorageSet("siga_visitor_id", id);
    }

    return id;
  }

  function getSessionId() {
    const now = Date.now();
    let id = safeStorageGet("siga_session_id");
    const lastActivity = Number(safeStorageGet("siga_session_last_activity") || 0);

    if (!id || !lastActivity || now - lastActivity > SESSION_TIMEOUT_MS) {
      id = uuid();
      safeStorageSet("siga_session_id", id);
    }

    if (!safeStorageSet("siga_session_last_activity", String(now))) {
      if (!memorySessionId || now - memorySessionActivity > SESSION_TIMEOUT_MS) {
        memorySessionId = uuid();
      }
      memorySessionActivity = now;
      return memorySessionId;
    }

    return id;
  }

  function normalizePagePath() {
    let path = window.location.pathname || "/";

    if (path === "/geodata" || path === "/geodata/") {
      return "/index.html";
    }

    if (path.startsWith("/geodata/")) {
      path = path.slice("/geodata".length);
    }

    if (!path || path === "/") {
      return "/index.html";
    }

    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    return path;
  }

  function sanitizeReferrer() {
    if (!document.referrer) return null;

    try {
      const url = new URL(document.referrer);
      return url.origin + url.pathname;
    } catch {
      return null;
    }
  }

  function getDeviceType() {
    const ua = navigator.userAgent || "";

    if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
    return "desktop";
  }

  function getBrowser() {
    const ua = navigator.userAgent || "";

    if (/Edg\//i.test(ua)) return "Edge";
    if (/OPR\//i.test(ua)) return "Opera";
    if (/Firefox\//i.test(ua)) return "Firefox";
    if (/Chrome\//i.test(ua)) return "Chrome";
    if (/Safari\//i.test(ua)) return "Safari";

    return "Otro";
  }

  function safeTargetPath(href) {
    try {
      const url = new URL(href, window.location.href);

      // Para enlaces internos guardamos sólo el pathname.
      if (url.origin === window.location.origin) {
        return url.pathname;
      }

      // Para externos guardamos dominio + pathname, nunca querystring.
      return url.origin + url.pathname;
    } catch {
      return null;
    }
  }

  async function track(eventName, metadata = {}) {
    if (!isProduction) return;

    const payload = {
      p_event_name: eventName,
      p_page_path: normalizePagePath(),
      p_page_title: document.title || null,
      p_visitor_id: getVisitorId(),
      p_session_id: getSessionId(),
      p_referrer: sanitizeReferrer(),
      p_device_type: getDeviceType(),
      p_browser: getBrowser(),
      p_screen_width: window.screen?.width || null,
      p_viewport_width: window.innerWidth || null,
      p_language: navigator.language || null,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      p_metadata: metadata && typeof metadata === "object" ? metadata : {}
    };

    try {
      const response = await fetch(RPC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify(payload),
        keepalive: true
      });

      if (!response.ok) {
        console.debug("SIGA analytics: evento no registrado", response.status);
      }
    } catch (error) {
      // La analítica nunca debe bloquear el funcionamiento del sitio.
      console.debug("SIGA analytics:", error);
    }
  }

  window.sigaAnalytics = { track };

  // Una vista por carga real de página.
  track("page_view");

  // Aperturas de PDF y descargas mediante enlaces.
  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href) return;

    const cleanHref = href.split("#")[0].split("?")[0].toLowerCase();
    const targetPath = safeTargetPath(href);

    if (cleanHref.endsWith(".pdf")) {
      track("pdf_open", {
        target_path: targetPath,
        link_text: (link.textContent || "").trim().slice(0, 150) || null
      });
    }

    if (link.hasAttribute("download")) {
      track("download", {
        target_path: targetPath,
        link_text: (link.textContent || "").trim().slice(0, 150) || null
      });
    }
  }, { capture: true });
})();
