import type { Categoria } from "@/components/transactions/types";

// Definimos qué datos se necesitan para crear/editar
export type CreateCategoryDTO = {
  nombre: string;
  tipo: "INGRESO" | "GASTO" | "TRANSFERENCIA";
  color?: string;
  icono?: string | null;
};

type FetchOptions = {
  accessToken?: string | null;
};

export class CategoriaService {
  // Helper para cabeceras
  private static headers({ accessToken }: FetchOptions) {
    return {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
  }

  // GET: Obtener todas
  static async obtenerTodas(opts: FetchOptions): Promise<Categoria[]> {
    const res = await fetch("/api/categories", { // Asegúrate que tu ruta API sea esta o "/api/categorias"
      method: "GET",
      headers: this.headers(opts),
    });
    if (!res.ok) throw new Error("Error al obtener categorías");
    return res.json();
  }

  // POST: Crear
  static async crear(data: CreateCategoryDTO, opts: FetchOptions): Promise<Categoria> {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: this.headers(opts),
      body: JSON.stringify(data),
    });
    
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al crear categoría");
    }
    return res.json();
  }

  // PATCH: Actualizar (Este es el que te faltaba)
  static async actualizar(id: string, data: Partial<CreateCategoryDTO>, opts: FetchOptions): Promise<Categoria> {
    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: this.headers(opts),
      body: JSON.stringify({ id, ...data }), // Enviamos ID dentro del body para mantener consistencia
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al actualizar categoría");
    }
    return res.json();
  }

  // DELETE: Eliminar
  static async eliminar(id: string, opts: FetchOptions): Promise<void> {
    const res = await fetch("/api/categories", {
      method: "DELETE",
      headers: this.headers(opts),
      body: JSON.stringify({ id }),
    });

    if (!res.ok) throw new Error("Error al eliminar categoría");
    return res.json();
  }
}