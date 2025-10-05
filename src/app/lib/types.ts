export interface Lens {
  id: string;
  name: string;
  sensorSize: string;
  efl: number;
  maxImageCircle: number;
  fNo: number;
  fovD: number;
  fovH: number;
  fovV: number;
  ttl: number;
  tvDistortion: number;
  relativeIllumination: number;
  chiefRayAngle: number;
  mountType: 'C-Mount' | 'CS-Mount' | 'M12' | 'Custom';
  lensStructure: string;
  price: number;
}
