"use client";







import { useCallback, useEffect, useMemo, useState } from "react";



import { Session } from "@supabase/supabase-js";



import { supabaseClient } from "@/lib/supabaseClient";



import { formatMoney } from "@/lib/formatMoney";



import { InputField, NumberField, SelectField } from "@/components/ui/Fields";







type TipoCuenta = { id: string; codigo: string; nombre: string };



type Cuenta = {



  id: string;



  usuarioId: string;



  tipoCuentaId: string;



  nombre: string;



  institucion?: string | null;



  moneda: string;



  saldo: number;



  limiteCredito?: number | null;



  tasaApr?: number | null;



  diaCorte?: number | null;



  diaPago?: number | null;



  plazoMeses?: number | null;



  tipoCuenta?: TipoCuenta | null;



  abiertaEn?: string | null;



  cerradaEn?: string | null;



};







type CuentaForm = {



  nombre: string;



  tipoCuentaId: string;



  moneda: string;



  saldo: number;



  institucion?: string | null;



  limiteCredito?: number | null;



  tasaApr?: number | null;



  diaCorte?: number | null;



  diaPago?: number | null;



  plazoMeses?: number | null;



};







const emptyForm: CuentaForm = {



  nombre: "",



  tipoCuentaId: "",



  moneda: "COP",



  saldo: 0,



  institucion: "",



};







const currencyOptions = [



  { label: "Peso colombiano (COP)", value: "COP" },



  { label: "Dólar (USD)", value: "USD" },



  { label: "Euro (EUR)", value: "EUR" },



  { label: "Libra esterlina (GBP)", value: "GBP" },



  { label: "Peso mexicano (MXN)", value: "MXN" },



];







export default function CuentasPage() {



  const [session, setSession] = useState<Session | null>(null);



  const [loadingSession, setLoadingSession] = useState(true);



  const [tipos, setTipos] = useState<TipoCuenta[]>([]);



  const [cuentas, setCuentas] = useState<Cuenta[]>([]);



  const [form, setForm] = useState<CuentaForm>(emptyForm);



  const [showModal, setShowModal] = useState(false);



  const [editingId, setEditingId] = useState<string | null>(null);



  const [busy, setBusy] = useState(false);



  const [error, setError] = useState<string | null>(null);



  const [saldoObjetivo, setSaldoObjetivo] = useState<string>("");



  const [ajusteNota, setAjusteNota] = useState<string>("");







  useEffect(() => {



    supabaseClient.auth.getSession().then(({ data }) => {



      setSession(data.session);



      setLoadingSession(false);



    });



    const { data } = supabaseClient.auth.onAuthStateChange((_evt, newSession) => {



      setSession(newSession);



    });



    return () => data.subscription.unsubscribe();



  }, []);







  const accessToken = session?.access_token;



  const authHeaders = useMemo(



    () =>



      accessToken



        ? { credentials: "include" as const, headers: { Authorization: `Bearer ${accessToken}` } }



        : { credentials: "include" as const },



    [accessToken],



  );













  const tipoNormalId = useMemo(



    () =>



      tipos.find(



        (t) =>



          t.codigo?.toUpperCase?.() === "NORMAL" ||



          t.codigo?.toUpperCase?.() === "CUENTA_NORMAL",



      )?.id,



    [tipos],



  );







  useEffect(() => {



    if (tipoNormalId && !editingId) {



      setForm((f) => ({ ...f, tipoCuentaId: tipoNormalId }));



    }



  }, [tipoNormalId, editingId]);







  const ajusteCalculado = useMemo(() => {



    if (!editingId) return 0;



    if (saldoObjetivo === "") return 0;



    const deseado = Number(saldoObjetivo);



    if (Number.isNaN(deseado)) return 0;



    return deseado - Number(form.saldo ?? 0);



  }, [editingId, saldoObjetivo, form.saldo]);







  const loadTipos = useCallback(async () => {
    if (!accessToken) return;
    const res = await fetch("/api/tipos-cuenta", authHeaders);
    if (res.ok) setTipos(await res.json());
  }, [accessToken, authHeaders]);

  const loadCuentas = useCallback(async () => {
    if (!accessToken) return;
    const res = await fetch("/api/accounts", authHeaders);
    if (res.ok) setCuentas(await res.json());
  }, [accessToken, authHeaders]);

  useEffect(() => {
    if (!accessToken) return;
    void Promise.all([loadTipos(), loadCuentas()]);
  }, [accessToken, loadTipos, loadCuentas]);







  const validate = () => {



    if (!form.nombre.trim()) return "Nombre obligatorio";



    if (!form.tipoCuentaId) return "Cuenta normal requerida";



    if (!form.moneda.trim() || form.moneda.length > 5) return "Moneda invalida";



    if (form.limiteCredito !== undefined && (form.limiteCredito ?? 0) < 0) return "Limite no puede ser negativo";



    return null;



  };







  const saveCuenta = async () => {



    const validation = validate();



    if (validation) return setError(validation);



    if (!accessToken) return setError("No hay sesion activa");



    setBusy(true);



    setError(null);



    try {



      const { saldo, ...rest } = form;



      const payload: Record<string, unknown> = {



        ...rest,



        tipoCuentaId: tipoNormalId || form.tipoCuentaId,



        nombre: form.nombre.trim(),



        institucion: form.institucion?.trim() || null,



      };



      if (editingId && saldoObjetivo !== "") {



        const deseado = Number(saldoObjetivo);



        if (!Number.isNaN(deseado)) {



          const delta = deseado - Number(saldo ?? 0);



          if (delta !== 0) {



            payload.ajusteSaldo = delta;



            if (ajusteNota.trim()) {



              payload.ajusteDescripcion = ajusteNota.trim();



            }



          }



        }



      }



      const res = await fetch("/api/accounts", {



        method: editingId ? "PATCH" : "POST",



        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },



        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),



        credentials: "include",



      });



      if (!res.ok) {



        const data = await res.json();



        throw new Error(data?.error || "No se pudo guardar la cuenta");



      }



      resetForm();



      setShowModal(false);



      await loadCuentas();



    } catch (err) {



      setError(err instanceof Error ? err.message : "Error desconocido");



    } finally {



      setBusy(false);



    }



  };







  const startEdit = (cta: Cuenta) => {



    setEditingId(cta.id);



    setForm({



      nombre: cta.nombre,



      tipoCuentaId: tipoNormalId || cta.tipoCuentaId,



      moneda: cta.moneda,



      saldo: Number(cta.saldo ?? 0),



      institucion: cta.institucion ?? "",



      limiteCredito: cta.limiteCredito ? Number(cta.limiteCredito) : null,



      tasaApr: cta.tasaApr ? Number(cta.tasaApr) : null,



      diaCorte: cta.diaCorte ?? null,



      diaPago: cta.diaPago ?? null,



      plazoMeses: cta.plazoMeses ?? null,



    });



    setSaldoObjetivo(



      cta.saldo !== undefined && cta.saldo !== null



        ? String(Number(cta.saldo ?? 0))



        : "",



    );



    setAjusteNota("");



    setShowModal(true);



  };







  const deleteCuenta = async (id: string) => {



    if (!accessToken) return setError("No hay sesion activa");



    if (!confirm("¿Eliminar esta cuenta?")) return;



    setBusy(true);



    setError(null);



    try {



      const res = await fetch("/api/accounts", {



        method: "DELETE",



        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },



        body: JSON.stringify({ id }),



        credentials: "include",



      });



      if (!res.ok) {



        const data = await res.json();



        throw new Error(data?.error || "No se pudo eliminar la cuenta");



      }



      await loadCuentas();



    } catch (err) {



      setError(err instanceof Error ? err.message : "Error desconocido");



    } finally {



      setBusy(false);



    }



  };







  const resetForm = () => {



    setForm(emptyForm);



    setEditingId(null);



    setSaldoObjetivo("");



    setAjusteNota("");



  };







  return (



    <div className="min-h-screen px-6 py-10 text-slate-900 dark:text-zinc-50">



      <div className="mx-auto flex max-w-5xl flex-col gap-6">



        <header className="flex flex-wrap items-center justify-between gap-3">



          <div>



            <p className="text-xs uppercase tracking-[0.3em] text-sky-500">Cuentas</p>



            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Gestiona tus cuentas</h1>



            <p className="text-sm text-slate-600 dark:text-zinc-400">Crea, edita o elimina cuentas, tarjetas y préstamos.</p>



          </div>



          <button



            onClick={() => {



              resetForm();



              setShowModal(true);



            }}



            className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-400"



          >



            + Nueva cuenta



          </button>



        </header>







        {error && (



          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">



            {error} <button className="underline" onClick={() => setError(null)}>cerrar</button>



          </div>



        )}







        {loadingSession && <p className="text-sm text-slate-500">Cargando sesión...</p>}







        {!loadingSession && (



          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">



            {cuentas.map((cta) => (



              <div



                key={cta.id}



                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow dark:border-white/10 dark:bg-black/30"



              >



                <div className="flex items-start justify-between gap-2">



                  <div>



                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{cta.nombre}</p>



                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-zinc-400">



                      {cta.tipoCuenta?.nombre ?? cta.tipoCuentaId}



                    </p>



                  </div>



                  <div className="text-right">



                    <p className="text-xl font-semibold text-emerald-500">



                      {formatMoney(Number(cta.saldo ?? 0), cta.moneda)}



                    </p>



                    {cta.tasaApr && <p className="text-xs text-slate-500 dark:text-zinc-400">{cta.tasaApr}% APR</p>}



                  </div>



                </div>



                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-zinc-400">



                  {cta.limiteCredito ? <span>💳 Límite: {formatMoney(Number(cta.limiteCredito), cta.moneda)}</span> : null}



                  {cta.plazoMeses ? <span>⏳ Plazo: {cta.plazoMeses}m</span> : null}



                  {cta.diaCorte ? <span>🗓️ Corte: {cta.diaCorte}</span> : null}



                  {cta.diaPago ? <span>💸 Pago: {cta.diaPago}</span> : null}



                </div>



                <div className="mt-4 flex gap-2">



                  <button



                    onClick={() => startEdit(cta)}



                    className="rounded-full border border-sky-400/50 px-3 py-1 text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:text-sky-200 dark:hover:bg-sky-500/10"



                  >



                    ✏️ Editar



                  </button>



                  <button



                    onClick={() => void deleteCuenta(cta.id)}



                    className="rounded-full border border-red-400/60 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-500/20 dark:text-red-200"



                    disabled={busy}



                  >



                    🗑️ Eliminar



                  </button>



                </div>



              </div>



            ))}



            {cuentas.length === 0 && <p className="text-sm text-slate-500 dark:text-zinc-400">No tienes cuentas aún.</p>}



          </div>



        )}



      </div>







      {showModal && (



        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">



          <div className="w-full max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">



            <div className="mb-4 flex items-center justify-between">



              <div>



                <p className="text-xs uppercase tracking-[0.3em] text-sky-400">



                  {editingId ? "Edición" : "Creación"}



                </p>



                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">



                  {editingId ? "Editar cuenta" : "Nueva cuenta"}



                </h3>



              </div>



              {editingId && (



                <div className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-500">



                  En uso



                </div>



              )}



              <button



                onClick={() => {



                  setShowModal(false);



                  resetForm();



                }}



                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"



              >



                Cerrar



              </button>



            </div>



            <div className="grid grid-cols-1 gap-3">



              <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm text-slate-700 shadow-inner dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">



                <div className="flex items-center justify-between">



                  <div>



                    <p className="text-xs uppercase tracking-[0.2em] text-sky-400">Resumen</p>



                    <p className="text-base font-semibold text-slate-900 dark:text-white">{form.nombre || "Cuenta sin nombre"}</p>



                    <p className="text-xs text-zinc-400">Cuenta normal · {form.moneda}</p>



                  </div>



                  <div className="text-right">



                    <p className="text-sm text-slate-500 dark:text-zinc-400">Saldo actual</p>



                    <p className="text-xl font-semibold text-emerald-400">{formatMoney(Number(form.saldo || 0), form.moneda)}</p>



                  </div>



                </div>



              </div>







              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">



                <InputField label="Nombre" value={form.nombre} onChange={(v) => setForm((f) => ({ ...f, nombre: v }))} />



                <div className="text-sm text-slate-600 dark:text-zinc-300">



                  <p className="font-semibold text-slate-900 dark:text-white">Tipo de cuenta</p>



                  <p className="text-xs text-slate-500 dark:text-zinc-400">



                    Cuenta normal (predeterminada)



                  </p>



                </div>



                <InputField label="Institución (opcional)" value={form.institucion ?? ""} onChange={(v) => setForm((f) => ({ ...f, institucion: v }))} />



                <SelectField



                  label="Moneda"



                  value={form.moneda}



                  onChange={(v) => setForm((f) => ({ ...f, moneda: v }))}



                  options={currencyOptions}



                  placeholder="Selecciona"



                />



              </div>







              {editingId ? (



                <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 text-sm shadow-inner dark:border-white/10 dark:bg-white/5">



                  <div className="flex flex-wrap items-center justify-between gap-3">



                    <div>



                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">Ajuste de saldo</p>



                      <p className="text-base font-semibold text-slate-900 dark:text-white">



                        Actual: {formatMoney(Number(form.saldo || 0), form.moneda)}



                      </p>



                    </div>



                    <div className="text-right text-xs text-slate-500 dark:text-zinc-400">



                      <p>Ajuste calculado</p>



                      <p



                        className={`text-sm font-semibold ${



                          ajusteCalculado > 0



                            ? "text-emerald-500"



                            : ajusteCalculado < 0



                              ? "text-rose-500"



                              : "text-slate-500 dark:text-zinc-400"



                        }`}



                      >



                        {ajusteCalculado === 0



                          ? "Sin ajuste"



                          : `${ajusteCalculado > 0 ? "+" : "-"}${formatMoney(Math.abs(ajusteCalculado), form.moneda)}`}



                      </p>



                    </div>



                  </div>



                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">



                    <NumberField

                      label="Saldo deseado"

                      value={saldoObjetivo}

                      onChange={(v) => setSaldoObjetivo(v)}

                      isCurrency

                      currency={form.moneda}

                      allowNegative

                    />

                    <InputField



                      label="Nota de ajuste (opcional)"



                      value={ajusteNota}



                      onChange={(v) => setAjusteNota(v)}



                      placeholder="Ej. Ajuste manual por conciliaci?n"



                    />



                  </div>



                  <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">



                    Al guardar se generar? una transacci?n interna con el ajuste indicado.



                  </p>



                </div>



              ) : (



                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 dark:border-white/20 dark:text-zinc-400">



                  El saldo se actualizar? cuando registres transacciones o ajustes posteriores.



                </div>



               )}


              {renderCuentaFields()}



              <div className="flex flex-wrap gap-3 pt-2">



                <button



                  onClick={() => {



                    setShowModal(false);



                    resetForm();



                  }}



                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"



                >



                  Cancelar



                </button>



                <button



                  onClick={saveCuenta}



                  disabled={busy}



                  className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"



                >



                  {busy ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}



                </button>



              </div>



            </div>



          </div>



        </div>



      )}



    </div>



  );



}











function renderCuentaFields() {

  return (

    <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 dark:border-white/20 dark:text-zinc-400">

      El tipo de cuenta es siempre &quot;Cuenta normal&quot;; sin campos adicionales.

    </div>

  );

}
