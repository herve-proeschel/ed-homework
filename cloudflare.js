export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Token, 2fa-token, Authorization, Cookie, x-gtk, x-cookies",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);
    // Supprime les éventuels doubles slashs au début du chemin
    const cleanPath = url.pathname.replace(/^\/+/, '/');
    const targetUrl = "https://api.ecoledirecte.com" + cleanPath + url.search;

    const modifiedHeaders = new Headers(request.headers);
    modifiedHeaders.set("Host", "api.ecoledirecte.com");
    modifiedHeaders.set("Origin", "https://www.ecoledirecte.com");
    modifiedHeaders.set("Referer", "https://www.ecoledirecte.com/");
    modifiedHeaders.set("Accept", "application/json, text/plain, */*");
    modifiedHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36");

    // Reconstitue le Cookie et le header x-gtk si transmis par le front
    const gtkValue = request.headers.get("x-gtk");
    const customCookies = request.headers.get("x-cookies");

    if (gtkValue) {
      modifiedHeaders.set("x-gtk", gtkValue);
    }

    let cookieHeader = customCookies || request.headers.get("Cookie") || "";
    if (gtkValue && !cookieHeader.includes("GTK=")) {
      cookieHeader = (cookieHeader ? cookieHeader + "; " : "") + `GTK=${gtkValue}`;
    }
    if (cookieHeader) {
      modifiedHeaders.set("Cookie", cookieHeader);
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: modifiedHeaders,
        body: request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : null,
      });

      const newResponseHeaders = new Headers(response.headers);
      newResponseHeaders.set("Access-Control-Allow-Origin", "*");
      newResponseHeaders.set("Access-Control-Expose-Headers", "X-Token, x-token, 2fa-token, x-all-cookies, Set-Cookie, x-gtk");

      // Capture tous les Set-Cookie
      let cookieArray = [];
      if (typeof response.headers.getSetCookie === 'function') {
        cookieArray = response.headers.getSetCookie();
      } else {
        const sc = response.headers.get('set-cookie');
        if (sc) cookieArray = [sc];
      }

      if (cookieArray.length > 0) {
        const combined = cookieArray.map(c => c.split(';')[0]).join('; ');
        newResponseHeaders.set("x-all-cookies", combined);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newResponseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};