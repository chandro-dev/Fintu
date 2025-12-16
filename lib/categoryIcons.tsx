import { 
  ShoppingBag, Utensils, Car, Home, Zap, HeartPulse, 
  GraduationCap, Plane, Gamepad2, Gift, Briefcase, 
  DollarSign, Smartphone, Wifi, Coffee, Music, 
  MoreHorizontal, Tag, Shirt, Dumbbell, Baby, Dog, 
  Hammer, BookOpen
} from "lucide-react";

// ============================================================================
// 1. MAPA DE ICONOS
// ============================================================================
export const ICON_MAP: Record<string, any> = {
  "tag": Tag,
  "shopping": ShoppingBag,
  "food": Utensils,
  "transport": Car,
  "home": Home,
  "bills": Zap,
  "health": HeartPulse,
  "education": GraduationCap,
  "book": BookOpen,
  "travel": Plane,
  "entertainment": Gamepad2,
  "gift": Gift,
  "work": Briefcase,
  "salary": DollarSign,
  "tech": Smartphone,
  "internet": Wifi,
  "coffee": Coffee,
  "music": Music,
  "sport": Dumbbell,
  "clothes": Shirt,
  "baby": Baby,
  "pet": Dog,
  "tools": Hammer,
  "other": MoreHorizontal,
};

// ============================================================================
// 2. EXPORTACIONES PARA COMPATIBILIDAD (Solución del Error)
// ============================================================================

// Esto arregla el error: "Export AVAILABLE_ICONS doesn't exist"
export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

// Alias por si usaste ICON_KEYS en algún otro lado nuevo
export const ICON_KEYS = AVAILABLE_ICONS; 

// Helper funcional (por si algún componente viejo lo usa directamente)
export const getCategoryIcon = (iconName?: string | null) => {
  return ICON_MAP[iconName || "tag"] || Tag;
};

// ============================================================================
// 3. COLORES PREDEFINIDOS
// ============================================================================
export const AVAILABLE_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#f43f5e", // rose
  "#64748b", // slate
  "#171717", // neutral-900
];

// ============================================================================
// 4. COMPONENTE VISUAL (Recomendado para uso nuevo)
// ============================================================================
interface CategoryIconProps {
  name?: string | null;
  size?: number;
  className?: string;
}

export function CategoryIcon({ name, size = 20, className = "" }: CategoryIconProps) {
  const IconComponent = getCategoryIcon(name);
  return <IconComponent size={size} className={className} />;
}