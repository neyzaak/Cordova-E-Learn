/* ============================================================
   Cloudflare Pages Functions — adaptor Node http -> Fetch API.
   Memanggil handler server.js (handleApi) yang sama persis
   dengan mode lokal maupun Vercel. Database (DATABASE_URL) dan
   GURU_PASSWORD dibaca dari binding env Pages.
   ============================================================ */
"use strict";

let serverPromise = null;
let initPromise = null;

/* Mengambil modul server.js SECARA DINAMIS, supaya env (DATABASE_URL,
   GURU_PASSWORD) sempat diisi lebih dulu sebelum kode top-level
   server.js berjalan (USE_DB dll. ditentukan saat module dimuat). */
function getServer(env) {
  if (!serverPromise) {
    serverPromise = (async () => {
      if (env && typeof env === "object") {
        for (const k of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "GURU_PASSWORD"]) {
          if (env[k] != null && process.env[k] === undefined) {
            process.env[k] = String(env[k]);
          }
        }
      }
      const mod = await import("../../server.js");
      return mod;
    })();
    serverPromise.catch(() => {
      serverPromise = null; // izinkan coba lagi pada request berikutnya
    });
  }
  return serverPromise;
}

function ensureInit(env) {
  if (!initPromise) {
    initPromise = getServer(env)
      .then((mod) => mod.initStorage())
      .then(() => true)
      .catch((e) => {
        console.error("[cf] gagal init storage:", e && e.message);
        initPromise = null;
        throw e;
      });
  }
  return initPromise;
}

/* ----- req/ res gaya Node, dibangun dari Fetch Request ----- */
function createFakeReq(request, bodyText, pathname) {
  const req = {
    method: request.method,
    url: pathname,
    headers: {},
    _body: bodyText,
    _destroyed: false,
    _listeners: {},
    _flushed: false,
    on(ev, cb) {
      (this._listeners[ev] = this._listeners[ev] || []).push(cb);
      this._flushWhenReady();
      return this;
    },
    removeListener(ev, cb) {
      this._listeners[ev] = (this._listeners[ev] || []).filter((f) => f !== cb);
      return this;
    },
    destroy() {
      this._destroyed = true;
    },
    // Body dikirim HANYA setelah 'data' dan 'end' dipasang listener.
    // (handleApi sempat await refresh DB lebih dulu; pengiriman dini
    //  akan membuat readBody kehilangan body dan request hang.)
    _flushWhenReady() {
      if (this._flushed) return;
      if (!(this._listeners.data && this._listeners.data.length)) return;
      if (!(this._listeners.end && this._listeners.end.length)) return;
      this._flushed = true;
      const bodyText = this._body;
      const self = this;
      queueMicrotask(() => {
        self._emit("data", bodyText);
        self._emit("end");
      });
    },
    _emit(ev, ...args) {
      for (const cb of this._listeners[ev] || []) cb(...args);
    }
  };
  request.headers.forEach((v, k) => {
    req.headers[k.toLowerCase()] = v;
  });
  return req;
}

function createFakeRes() {
  const state = { status: 200, headers: {}, body: "", ended: false };
  let resolveDone = null;
  const done = new Promise((r) => {
    resolveDone = r;
  });
  const res = {
    statusCode: 200,
    get headersSent() {
      return state.ended;
    },
    writeHead(code, headers) {
      state.status = code;
      if (headers) Object.assign(state.headers, headers);
    },
    setHeader(k, v) {
      state.headers[k] = v;
    },
    end(chunk) {
      if (state.ended) return;
      state.ended = true;
      if (chunk != null) state.body += chunk;
      resolveDone();
    }
  };
  return {
    res,
    done,
    _toResponse() {
      return new Response(state.body || "", { status: state.status, headers: state.headers });
    }
  };
}

/* Menjalankan handleApi lalu mengubah hasilnya menjadi Response */
async function runNodeHandler(request, pathname, server) {
  const bodyText = await request.text();
  const { res, done, _toResponse } = createFakeRes();
  const req = createFakeReq(request, bodyText, pathname);
  Promise.resolve(server.handleApi(req, res, pathname)).catch((e) => {
    console.error("[cf] handleApi error:", e && e.stack);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "Server sedang sibuk. Coba lagi." }));
    } else {
      res.end();
    }
  });
  await done;
  return _toResponse();
}

/* Membuat handler Pages Functions untuk satu route API tertentu */
export function makeHandler(pathname) {
  return async function onRequest(context) {
    const server = await getServer(context && context.env);
    await ensureInit(context && context.env);
    return runNodeHandler(context.request, pathname, server);
  };
}