export default function CuentasPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-white">Cuentas</h1>
        <p className="mt-2 text-zinc-300">
          Gestiona tus cuentas aquí. En el dashboard puedes crear/editar cuentas normales, tarjetas y préstamos; aquí consulta su información.
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-zinc-300">
          <li>Consulta el saldo actualizado tras cada transacción.</li>
          <li>Identifica el tipo de cuenta (NORMAL, TARJETA_CREDITO, PRESTAMO) y sus límites o tasas.</li>
          <li>Usa la navegación inferior (visible cuando inicias sesión) para volver al dashboard.</li>
        </ul>
      </div>
    </div>
  );
}
