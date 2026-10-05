/**
 * Guarda a loja do App Funcionários em vários lugares do aparelho
 * (localStorage, sessionStorage, cookie e IndexedDB). Se o celular apagar
 * um deles, os outros recuperam a loja silenciosamente.
 */
const KEY = "funcionarios_loja_id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DB_NAME = "compra360-reposicao";
const STORE = "kv";

export const isLojaIdValido = (v: string | null | undefined): v is string => !!v && UUID_RE.test(v);

const safe = <T,>(fn: () => T): T | null => {
  try {
    return fn();
  } catch {
    return null;
  }
};

const lerCookie = (): string | null =>
  safe(() => document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]+)`))?.[1] ?? null);

/** Leitura síncrona (localStorage → sessionStorage → cookie). */
export const lerLojaSync = (): string => {
  const candidatos = [
    safe(() => window.localStorage.getItem(KEY)),
    safe(() => window.sessionStorage.getItem(KEY)),
    lerCookie(),
  ];
  return candidatos.find(isLojaIdValido) || "";
};

const abrirDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

/** Leitura assíncrona do IndexedDB (último recurso). */
export const lerLojaIndexedDb = async (): Promise<string> => {
  const db = await abrirDb();
  if (!db) return "";
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(isLojaIdValido(req.result) ? req.result : "");
      req.onerror = () => resolve("");
    } catch {
      resolve("");
    }
  });
};

/** Grava a loja em todos os lugares disponíveis. */
export const gravarLoja = (lojaId: string) => {
  if (!isLojaIdValido(lojaId)) return;
  safe(() => window.localStorage.setItem(KEY, lojaId));
  safe(() => window.sessionStorage.setItem(KEY, lojaId));
  safe(() => {
    document.cookie = `${KEY}=${lojaId}; path=/; max-age=${60 * 60 * 24 * 400}; SameSite=Lax`;
  });
  void abrirDb().then((db) => {
    if (!db) return;
    safe(() => db.transaction(STORE, "readwrite").objectStore(STORE).put(lojaId, KEY));
  });
};
