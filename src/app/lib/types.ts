
export interface Lens {
  id: string;
  name: string;
  sensorSize: string | null;
  efl: string | null;
  maxImageCircle: string | null;
  fNo: string | null;
  fovD: string | null;
  fovH: string | null;
  fovV: string | null;
  ttl: string | null;
  tvDistortion: string | null;
  relativeIllumination: string | null;
  chiefRayAngle: string | null;
  mountType: string | null;
  lensStructure: string | null;
  price: string | null;
  pdfUrl: string | null;
  sourcePath?: string;
  extractionStatus?: 'extracted' | 'failed' | 'needs_review';
  debug_pdfText_sample?: string;
  debug_aiRaw?: string;
  debug_parseResult?: Record<string, any>;
  debug_error?: string;
  updatedAt?: any;
  createdAt?: any;
  missingFields?: string[];
}

export interface SupplierLens extends Lens {
  supplier: string;
}
