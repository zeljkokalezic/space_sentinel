import type { ComponentType, SVGProps } from 'react';
import { Shield, Heart, Zap, Crosshair, Rocket, Activity, Magnet, Wrench, Target, RadioTower } from 'lucide-react';

export type UpgradeId =
  | 'autoAim'
  | 'autocannon'
  | 'plasma'
  | 'missiles'
  | 'hull'
  | 'shield'
  | 'thrusters'
  | 'magnet'
  | 'pointDefense'
  | 'emergencyBeacon';

export interface UpgradeDefinition {
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  desc: string;
  baseCost: number;
  costMult: number;
  maxLevel: number;
  isConsumable?: boolean;
}

export const UPGRADE_DATA: Record<UpgradeId, UpgradeDefinition> = {
  autoAim: { name: 'Targeting AI', icon: Target, desc: 'Automatically locks weapons onto the nearest enemy.', baseCost: 150, costMult: 1, maxLevel: 1 },
  autocannon: { name: 'Twin Autocannon', icon: Crosshair, desc: 'Increases basic attack fire rate & damage.', baseCost: 30, costMult: 1.5, maxLevel: 20 },
  plasma: { name: 'Plasma Piercer', icon: Zap, desc: 'Slow, heavy shots that pierce multiple enemies.', baseCost: 80, costMult: 1.6, maxLevel: 10 },
  missiles: { name: 'Seeker Swarm', icon: Rocket, desc: 'Launches homing missiles that track targets.', baseCost: 120, costMult: 1.7, maxLevel: 10 },
  hull: { name: 'Reinforced Hull', icon: Heart, desc: 'Increases Max HP by 50 and repairs hull.', baseCost: 50, costMult: 1.4, maxLevel: 20 },
  shield: { name: 'Energy Shield', icon: Shield, desc: 'Adds a regenerating protective forcefield.', baseCost: 100, costMult: 1.5, maxLevel: 10 },
  thrusters: { name: 'Ion Thrusters', icon: Activity, desc: 'Increases ship movement speed & agility.', baseCost: 40, costMult: 1.3, maxLevel: 8 },
  magnet: { name: 'Scrap Magnet', icon: Magnet, desc: 'Increases pickup radius for destroyed enemies.', baseCost: 30, costMult: 1.4, maxLevel: 10 },
  pointDefense: { name: 'Point Defense', icon: Wrench, desc: 'Short-range auto-lasers shred nearby threats.', baseCost: 150, costMult: 1.6, maxLevel: 10 },
  emergencyBeacon: { name: 'Emergency Beacon', icon: RadioTower, desc: 'Save position. Respawn here on death. [B] to activate.', baseCost: 200, costMult: 1, maxLevel: 1, isConsumable: true },
};
