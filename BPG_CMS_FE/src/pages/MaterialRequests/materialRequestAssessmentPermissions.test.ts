import { describe, expect, it } from 'vitest';
import { canViewMaterialRequestAssessment } from './materialRequestAssessmentPermissions';

describe('canViewMaterialRequestAssessment', () => {
  it.each([
    ['accountant'],
    ['TechnicalManager'],
    ['DIRECTOR'],
  ])('cho phép vai trò Procurement: %s', role => {
    expect(canViewMaterialRequestAssessment([role])).toBe(true);
  });

  it.each([
    [['siteengineer']],
    [['admin']],
    [[]],
    [undefined],
  ])('từ chối vai trò ngoài Procurement hoặc phiên không có vai trò', roles => {
    expect(canViewMaterialRequestAssessment(roles)).toBe(false);
  });
});
