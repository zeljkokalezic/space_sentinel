/**
 * Ship skins — visual customization for the player ship.
 * Each skin defines hull color, accent color, and engine glow color.
 * Non-default skins are purchased with scrap in the shop.
 */
export interface ShipSkin {
  id: string;
  name: string;
  hullColor: number;
  accentColor: number;
  engineGlow: number;
  cost: number;
}

export const SHIP_SKINS: ShipSkin[] = [
  { id: 'default',  name: 'Standard',     hullColor: 0x39ff14, accentColor: 0x39ff14, engineGlow: 0x39ff14, cost: 0 },
  { id: 'crimson',  name: 'Crimson Fury', hullColor: 0xef4444, accentColor: 0xf97316, engineGlow: 0xfacc15, cost: 500 },
  { id: 'frost',    name: 'Frostbite',    hullColor: 0x38bdf8, accentColor: 0x818cf8, engineGlow: 0xc084fc, cost: 750 },
  { id: 'gold',     name: 'Solar Flare',  hullColor: 0xfacc15, accentColor: 0xf97316, engineGlow: 0xef4444, cost: 1000 },
  { id: 'void',     name: 'Void Walker',  hullColor: 0xa78bfa, accentColor: 0xc084fc, engineGlow: 0xe879f9, cost: 1500 },
];
