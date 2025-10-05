import type { Lens } from './types';

export const lenses: Lens[] = [];

// These are now derived in the component from live data
// export const SENSOR_SIZES = [...new Set(lenses.map(l => l.sensorSize))].sort();
// export const MOUNT_TYPES = [...new Set(lenses.map(l => l.mountType))].sort();
