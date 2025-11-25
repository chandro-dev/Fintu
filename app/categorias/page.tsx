export default function CategoriasPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-white">Categorias</h1>
        <p className="mt-2 text-zinc-300">
          Crea y organiza categorias para tus ingresos, gastos y transferencias. En el dashboard puedes anadir nuevas y asignarlas a transacciones.
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-zinc-300">
          <li>Define colores para identificar rapidamente cada categoria.</li>
          <li>Asigna categorias en cada transaccion para ver resuenes claros.</li>
          <li>Accede al dashboard para gestionar categorias y ver su uso.</li>
        </ul>
      </div>
    </div>
  );
}
