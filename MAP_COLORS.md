# Map Color Reference

## Brand Palette

| Role | Color | Hex |
|---|---|---|
| Primary | Dark Navy | `#0B1E3D` |
| Secondary | Brand Teal | `#00C2A8` |
| Accent | Amber | `#F5A623` |
| Muted | Slate | `#5A6A7A` |

---

## Map Layer Colors

| Layer | Element | Color | Hex |
|---|---|---|---|
| **Base** | All geometry | Warm Cream | `#F0EDE6` |
| **Base** | Label text | Slate | `#5A6A7A` |
| **Base** | Label stroke | White | `#FFFFFF` |
| **City names** | Text fill | Dark Navy | `#0B1E3D` |
| **Neighborhoods** | Text fill | Cool Grey | `#7A8A9A` |
| **Local roads** | Fill | White | `#FFFFFF` |
| **Local roads** | Stroke | Warm Off-White | `#E8E2D8` |
| **Arterials** | Fill | Off-Cream | `#F5F2EC` |
| **Arterials** | Stroke | Light Sand | `#DDD8CC` |
| **Highways** | Fill | Brand Teal | `#00C2A8` |
| **Highways** | Stroke | Deep Teal | `#007A6B` |
| **Highways** | Label fill | Dark Navy | `#0B1E3D` |
| **Controlled access** | Fill | Dark Teal | `#009E8A` |
| **Controlled access** | Stroke | Very Dark Teal | `#006658` |
| **Water** | Fill | Google Blue | `#A8C7E8` |
| **Water** | Label fill | Blue-Grey | `#5B7FA6` |
| **Parks / nature** | Fill | Cool Mint | `#D8EDEA` |
| **Urban blocks** | Fill | Warm Sand | `#EAE5DB` |
| **POI icons** | — | Hidden | — |
| **Transit** | — | Hidden | — |

---

## Route & Overlay Colors

| Element | Color | Hex |
|---|---|---|
| Route line (solid) | Indigo Blue | `#4361EE` |
| Route outer glow | Indigo Blue 12% opacity | `#4361EE` |
| Route inner glow | Indigo Blue 20% opacity | `#4361EE` |
| Alt route | Cool Grey | `#A0AEBF` |
| Walk radius circle | Indigo Blue | `#4361EE` |
| Origin marker | Dark Navy + Teal ring | `#0B1E3D` / `#00C2A8` |
| Destination marker | Brand Teal teardrop | `#00C2A8` |
| Driver destination marker | Amber teardrop | `#F5A623` |
| Route badge background | Dark Navy | `#0B1E3D` |
| Route badge km text | Indigo Blue | `#4361EE` |
| GPS pulse rings | Electric Blue | `#2563EB` |
| GPS core dot | Electric Blue | `#2563EB` |

---

## Source File

All map colors are defined in [`src/lib/leaflet.ts`](src/lib/leaflet.ts) as `MAP_COLORS`, and map tiles are rendered via Leaflet/OpenStreetMap.
