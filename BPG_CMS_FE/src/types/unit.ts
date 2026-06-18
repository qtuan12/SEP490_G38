export interface Unit {
  unitId: number;
  unitCode: string;
  unitName: string;
}

export interface CreateUnitRequest {
  unitCode: string;
  unitName: string;
}

export interface UpdateUnitRequest {
  unitCode: string;
  unitName: string;
}
