export type Item = {
  id: string;
  title: string;
  note?: string;
  createdAt: number;
};

// In-memory list to keep things simple for now. This resets on server restart.
export const items: Item[] = [
  {
    id: "seed-1",
    title: "Configurar ambiente",
    note: "Revisar que Next y Tailwind corran bien.",
    createdAt: Date.now(),
  },
  {
    id: "seed-2",
    title: "Disenar primer MVP",
    note: "Solo UI y API en memoria por ahora.",
    createdAt: Date.now(),
  },
];
