/**
 * Mã lỗi nghiệp vụ do backend trả về trong ApiResponse.errorCode.
 * Đồng bộ với BPG.Domain/Constants/ErrorConstants.cs — sửa một bên phải sửa bên kia.
 *
 * Dùng mã thay vì so khớp nội dung message: message có thể đổi câu chữ bất cứ lúc nào
 * mà không làm hỏng logic FE.
 */
export const ErrorCodes = {
  // Xác thực / tài khoản
  Unauthorized: 'AUTH_001',
  Forbidden: 'AUTH_002',
  CurrentPasswordIncorrect: 'AUTH_004',
  SamePassword: 'AUTH_005',

  // Luồng quên mật khẩu / OTP
  OtpEmailNotFound: 'AUTH_010',
  OtpNotFound: 'AUTH_011',
  OtpExpired: 'AUTH_012',
  OtpTooManyAttempts: 'AUTH_013',
  OtpIncorrect: 'AUTH_014',
  ResetSessionInvalid: 'AUTH_015',

  // Validation
  ValidationFailed: 'VAL_001',

  // Nghiệp vụ chung
  NotFound: 'BIZ_001',
  InvalidUnitQuantity: 'BIZ_008',

  // Đơn mua hàng (PO)
  PoAlreadyCancelled: 'BIZ_009',
  PoCannotCancel: 'BIZ_010',
  PoHasReceipts: 'BIZ_011',
  PoCannotClose: 'BIZ_012',
  PoCancelReasonRequired: 'BIZ_013',
  PoCloseReasonRequired: 'BIZ_014',
  PoNumberExists: 'BIZ_015',
  PoRequestNotApproved: 'BIZ_016',
  PoMaterialNotInRequest: 'BIZ_017',
  PoQtyExceedsRequest: 'BIZ_018',
  PoProjectNotActive: 'BIZ_051',

  // Mua hàng trực tiếp (DP)
  DpNotDraft: 'BIZ_023',
  DpNotSubmitted: 'BIZ_024',
  DpAlreadyAudited: 'BIZ_025',
  DpAuditNoteRequired: 'BIZ_026',
  DpRejectionReasonRequired: 'BIZ_027',
  DpInvalidStatusForApproval: 'BIZ_028',
  DpNoItems: 'BIZ_029',
  DpNoReason: 'BIZ_030',
  DpNoInvoice: 'BIZ_031',
  DpInvalidQuantity: 'BIZ_032',
  DpInvalidUnitPrice: 'BIZ_033',
  DpProjectNotActive: 'BIZ_034',
  DpPhaseFrozen: 'BIZ_035',
  DpPurchaseDateInFuture: 'BIZ_036',
  DpPurchaseDateBeforeProject: 'BIZ_037',
  DpPurchaseDateAfterPhase: 'BIZ_038',
  DpPhaseProjectMismatch: 'BIZ_039',
  DpDuplicateMaterial: 'BIZ_040',
  DpInvalidUnit: 'BIZ_044',
  DpMaterialNotInBoq: 'BIZ_049',
} as const;

/**
 * Các mã OTP mà cách xử lý duy nhất là xin mã mới — hiển thị kèm gợi ý bấm "Gửi lại".
 * Khác với OtpIncorrect (nhập sai, vẫn còn lượt thử) chỉ cần cho nhập lại.
 */
export const OTP_NEEDS_RESEND_ERRORS: readonly string[] = [
  ErrorCodes.OtpNotFound,
  ErrorCodes.OtpExpired,
  ErrorCodes.OtpTooManyAttempts,
];

/** Mã lỗi liên quan tới ô "Ngày mua" khi gửi phiếu mua trực tiếp. */
export const DP_PURCHASE_DATE_ERRORS: readonly string[] = [
  ErrorCodes.DpPurchaseDateInFuture,
  ErrorCodes.DpPurchaseDateBeforeProject,
  ErrorCodes.DpPurchaseDateAfterPhase,
];
