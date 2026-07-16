export interface Unit {
  unitId: number;
  unitCode: string;
  unitName: string;
  isDiscrete: boolean;
}

export interface CreateUnitRequest {
  unitCode: string;
  unitName: string;
  isDiscrete: boolean;
}

export interface UpdateUnitRequest {
  unitCode: string;
  unitName: string;
  isDiscrete: boolean;
}
