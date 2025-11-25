export default function TransaccionesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-white">Transacciones</h1>
        <p className="mt-2 text-zinc-300">
          Consulta y administra tus movimientos. En el dashboard puedes crear y categorizar transacciones con las cuentas asociadas.
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-zinc-300">
          <li>Verifica ingresos/salidas y su categoría para un seguimiento claro.</li>
          <li>El saldo de cada cuenta se ajusta automáticamente con cada transacción.</li>
          <li>La navegación inferior aparece al iniciar sesión para moverte rápido entre secciones.</li>
        </ul>
      </div>
    </div>
  );
}
