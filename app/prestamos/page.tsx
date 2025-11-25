export default function PrestamosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-white">Prestamos</h1>
        <p className="mt-2 text-zinc-300">
          Gestiona prestamos. Crea cuentas de tipo prestamo en el dashboard para capturar tasa y
          plazo.
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-zinc-300">
          <li>Define tasa APR y plazo en meses.</li>
          <li>Observa el saldo restante despues de registrar pagos o desembolsos.</li>
          <li>Usa categorias para diferenciar pagos, intereses y otros movimientos.</li>
        </ul>
      </div>
    </div>
  );
}
