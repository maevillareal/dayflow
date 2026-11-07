import { Apple, CandyOff, Droplets, Dumbbell, Heart, Layers, PenTool, type LucideIcon } from "lucide-react";

export const CATEGORIES = ["MVG", "Exercise", "Self Care", "Skin Care", "Eat Healthy", "No Sugar"] as const;
export type Category = (typeof CATEGORIES)[number];
/** "All" is the All Progress aggregate view, not a category. */
export type CategoryFilter = Category | "All";

export const CAT_COLORS: Record<Category, string> = {
  MVG: "#F4B8CE",
  Exercise: "#8FC1F0",
  "Self Care": "#93D6BE",
  "Skin Care": "#F3D08A",
  "Eat Healthy": "#F0A584",
  "No Sugar": "#B9A4F0",
};

export const CAT_ICONS: Record<Category, LucideIcon> = {
  MVG: PenTool,
  Exercise: Dumbbell,
  "Self Care": Heart,
  "Skin Care": Droplets,
  "Eat Healthy": Apple,
  "No Sugar": CandyOff,
};
export const ALL_ICON = Layers;

/** Lei (dog) cheers on doing things; Tobi (cat) looks after care routines. */
export const CAT_COMPANION: Record<Category, "dog" | "cat"> = {
  MVG: "dog",
  Exercise: "dog",
  "Eat Healthy": "dog",
  "Self Care": "cat",
  "Skin Care": "cat",
  "No Sugar": "cat",
};

export const inFilter = (c: Category, f: CategoryFilter) => f === "All" || c === f;
export const isCategory = (v: unknown): v is Category => CATEGORIES.includes(v as Category);
