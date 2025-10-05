import type { Lens } from './types';

export const lenses: Lens[] = [];

export const SENSOR_SIZES = [...new Set(lenses.map(l => l.sensorSize))].sort();
export const MOUNT_TYPES = [...new Set(lenses.map(l => l.mountType))].sort();
