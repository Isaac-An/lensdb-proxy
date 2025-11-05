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
  mountType: string;
  lensStructure: string;
  price: number;
  pdfUrl?: string; // Add optional pdfUrl
}
