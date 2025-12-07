"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

/**
 * Entrada de cache para cada key:
 *  - data: resultado actual
 *  - error: último error
 *  - promise: petición en curso (para deduplicar)
 *  - subscribers: listeners que React registra para re-renderizar
 */
type CacheEntry<T> = {
  data?: T;
  error?: unknown;
  promise?: Promise<T>;
  subscribers: Set<() => void>;
};

/**
 * Mapa global de recursos cacheados por key.
 * Vive mientras la app esté cargada (similar a un store global).
 */
const cache = new Map<string, CacheEntry<any>>();

/**
 * Obtiene (o crea) la entrada del cache para una key.
 */
function getEntry<T>(key: string): CacheEntry<T> {
  let entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    entry = { subscribers: new Set() };
    cache.set(key, entry);
  }
  return entry;
}

/**
 * Notifica a todos los componentes suscritos a una key para que
 * React vuelva a llamar a getSnapshot y re-renderice.
 */
function notify(key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  entry.subscribers.forEach((fn) => fn());
}

/**
 * Carga los datos usando el fetcher y actualiza la entrada en cache.
 * También deduplica llamadas: si ya hay una promise en curso, la reutiliza.
 */
async function load<T>(key: string, fetcher: () => Promise<T>) {
  const entry = getEntry<T>(key);

  // Si ya hay una petición en vuelo, devolvemos esa misma promise.
  if (entry.promise) return entry.promise;

  entry.error = undefined;

  const p = fetcher()
    .then((data) => {
      entry.data = data;
      return data;
    })
    .catch((err) => {
      entry.error = err;
      throw err;
    })
    .finally(() => {
      entry.promise = undefined;
      notify(key); // avisamos que terminó (éxito o error)
    });

  entry.promise = p;

  // Notificamos para que los componentes vean que hay "loading: true"
  notify(key);

  return p;
}

/**
 * Lo que React ve como "snapshot" del store externo:
 * - data
 * - error
 * - loading
 */
type Snapshot<T> = {
  data?: T;
  error?: unknown;
  loading: boolean;
};

/**
 * Snapshot vacío y estable para SSR.
 * Es SIEMPRE la misma referencia, por eso no produce bucle infinito.
 */

/**
 * Hook principal de recurso cacheado.
 *
 * @param key   Identificador del recurso (debe ser estable entre renders).
 * @param fetcher Función que obtiene los datos (fetch, axios, etc.).
 * @param opts  Opciones como refreshOnMount.
 */
export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { refreshOnMount?: boolean },
) {
  const refreshOnMount = opts?.refreshOnMount ?? false;

  /**
   * Guardamos el fetcher en un ref para:
   *  - No tener que ponerlo en las dependencias del useEffect.
   *  - Usar siempre la versión más reciente, incluso si cambia.
   * Esto evita bucles cuando el componente pasa un fetcher inline.
   */
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  /**
   * Función que React llama para suscribirse a cambios del store.
   *  - Se registra el listener en la entrada de la key.
   *  - Se devuelve una función para desuscribirse.
   */
  const subscribe = useCallback(
    (listener: () => void) => {
      const entry = getEntry<T>(key);
      entry.subscribers.add(listener);
      return () => entry.subscribers.delete(listener);
    },
    [key],
  );

  /**
   * Snapshot en el CLIENTE:
   *  - Se construye un objeto nuevo en cada llamada a partir del entry.
   *  - React lo compara por referencia para detectar cambios.
   */
  const getClientSnapshot = useCallback(() => getEntry<T>(key), [key]);

  /**
   * Snapshot en el SERVIDOR:
   *  - Siempre devolvemos la MISMA referencia (EMPTY_SNAPSHOT).
   *  - Esto evita el warning:
   *    "The result of getServerSnapshot should be cached to avoid an infinite loop".
   *  - Como es un hook "use client", en la práctica sólo es relevante para hidratación.
   */
  const getServerSnapshot = useCallback(() => getEntry<T>(key), [key]);

  /**
   * useSyncExternalStore:
   *  - subscribe: cómo escuchar cambios
   *  - getSnapshot: cómo leer el estado actual en el cliente
   *  - getServerSnapshot: cómo leer un snapshot inicial en el servidor
   */
  const snapshotEntry = useSyncExternalStore<CacheEntry<T>>(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const snapshot: Snapshot<T> = useMemo(
    () => ({
      data: snapshotEntry.data as T | undefined,
      error: snapshotEntry.error,
      loading: Boolean(snapshotEntry.promise),
    }),
    [snapshotEntry.data, snapshotEntry.error, snapshotEntry.promise],
  );

  /**
   * Flag para saber si ya hicimos la primera carga en este hook.
   */
  const didInit = useRef(false);

  /**
   * Efecto que dispara el fetch automático:
   *  - Se ejecuta al montar y cuando cambian key o refreshOnMount.
   *  - NO depende de "fetcher" gracias al ref (evita bucles).
   */
  useEffect(() => {
    const entry = getEntry<T>(key);

    const shouldFetch =
      refreshOnMount ||
      !didInit.current ||
      (!entry.data && !entry.promise);

    if (shouldFetch) {
      // Usamos siempre el fetcher MÁS RECIENTE desde el ref.
      void load(key, () => fetcherRef.current());
      didInit.current = true;
    }
  }, [key, refreshOnMount]);

  /**
   * Devolvemos el snapshot + helpers.
   *  - data, error, loading vienen de useSyncExternalStore.
   *  - refresh: fuerza recarga.
   *  - mutate: actualiza el valor en cache (útil después de POST/PATCH/DELETE).
   *  - invalidate: borra data y error sin hacer fetch.
   */
  return useMemo(
    () => ({
      ...snapshot,
      refresh: () => load(key, () => fetcherRef.current()),
      mutate: (updater: (prev?: T) => T | Promise<T>) => {
        const entry = getEntry<T>(key);
        const next = updater(entry.data as T | undefined);
        return Promise.resolve(next).then((resolved) => {
          entry.data = resolved;
          notify(key);
          return resolved;
        });
      },
      invalidate: () => {
        const entry = getEntry<T>(key);
        entry.data = undefined;
        entry.error = undefined;
        notify(key);
      },
    }),
    [snapshot, key],
  );
}

/**
 * Invalida un recurso por key desde cualquier sitio (sin usar el hook).
 * Útil, por ejemplo, al hacer logout o resetear todo.
 */
export function invalidateResource(key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  entry.data = undefined;
  entry.error = undefined;
  notify(key);
}

/**
 * Mutación global de un recurso por key.
 *  - Se usa, por ejemplo, para actualizar una lista en cache después
 *    de crear / actualizar / eliminar una entidad.
 */
export function mutateResource<T>(
  key: string,
  updater: (prev?: T) => T | Promise<T>,
) {
  const entry = getEntry<T>(key);
  const next = updater(entry.data as T | undefined);
  return Promise.resolve(next).then((resolved) => {
    entry.data = resolved;
    notify(key);
    return resolved;
  });
}
