export default function TarjetasPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-white">Tarjetas de credito</h1>
        <p className="mt-2 text-zinc-300">
          Visualiza y gestiona tus tarjetas de credito. Crea cuentas de tipo tarjeta en el dashboard
          para capturar limite, APR, dia de corte y pago.
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-zinc-300">
          <li>Consulta limite, tasa APR y fechas de corte/pago.</li>
          <li>Las transacciones ajustan el saldo y puedes asignar categorias.</li>
          <li>Usa el dashboard para editar datos clave de cada tarjeta.</li>
        </ul>
      </div>
    </div>
  );
}
