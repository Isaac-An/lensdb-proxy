
export interface Lens {
  id: string;
  name: string;
  sensorSize: string;
  efl: string | number;
  maxImageCircle: string | number;
  fNo: string | number;
  fovD: string | number;
  fovH: string | number;
  fovV: string | number;
  ttl: string | number;
  tvDistortion: string | number;
  relativeIllumination: string | number;
  chiefRayAngle: string | number;
  mountType: string;
  lensStructure: string;
  price: string | number;
  pdfUrl?: string;
}
