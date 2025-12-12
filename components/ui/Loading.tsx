type LoadingProps = {
  message?: string;
};

export function Loading({ message = "Cargando..." }: LoadingProps) {
  return (
    <div className="flex h-full w-full items-center justify-center py-10">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {/* Bolita girando */}
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
        <span>{message}</span>
      </div>
    </div>
  );
}
