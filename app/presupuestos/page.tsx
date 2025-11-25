export default function PresupuestosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-white">Presupuestos</h1>
        <p className="mt-2 text-zinc-300">
          Define planes y asigna categorias para controlar tus gastos. Integra esta vista con
          las transacciones para medir cumplimiento.
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-zinc-300">
          <li>Define montos limite por periodo (mensual/anual).</li>
          <li>Asocia una categoria para monitorear el gasto respecto al plan.</li>
          <li>Consulta tu avance desde el dashboard y ajusta cuando sea necesario.</li>
        </ul>
      </div>
    </div>
  );
}
