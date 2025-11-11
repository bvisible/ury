import { call } from './frappe-sdk';

export interface POSOpeningResponse {
  message: number;
}

export interface POSCloseValidationResponse {
  message: string;
}

export interface POSOpeningEntry {
  name: string;
  period_start_date: string;
  posting_date: string;
  user: string;
  pos_profile: string;
  company: string;
  branch: string;
  status: string;
  docstatus: number;
}

export interface BalanceDetail {
  mode_of_payment: string;
  opening_amount: number;
}

export interface CreatePOSOpeningRequest {
  pos_profile: string;
  company: string;
  balance_details: BalanceDetail[];
}

export interface PaymentReconciliation {
  mode_of_payment: string;
  opening_amount: number;
  expected_amount: number;
  closing_amount: number;
  difference: number;
}

export interface POSClosingPreview {
  payment_reconciliation: PaymentReconciliation[];
  grand_total: number;
  net_total: number;
  total_quantity: number;
  invoice_count: number;
}

export interface CreatePOSClosingRequest {
  pos_opening_entry: string;
  payment_details: PaymentReconciliation[];
}

export const checkPOSOpening = async (): Promise<POSOpeningResponse> => {
  try {
    const response = await call.get<POSOpeningResponse>(
      'ury.ury_pos.api.posOpening'
    );

    return response;
  } catch (error) {
    console.error('Error checking POS opening status:', error);
    throw error;
  }
};

export const getCurrentPOSOpening = async (): Promise<string | null> => {
  try {
    // Get current user's open POS opening entry
    const { db, call } = await import('./frappe-sdk');

    // Get current user
    const userResponse = await call.get('frappe.auth.get_logged_user');
    const currentUser = userResponse.message;

    const openings = await db.getDocList('POS Opening Entry', {
      fields: ['name'],
      filters: [['status', '=', 'Open'], ['docstatus', '=', 1], ['user', '=', currentUser]],
      limit: 1,
      orderBy: { field: 'creation', order: 'desc' }
    });

    return openings.length > 0 ? openings[0].name : null;
  } catch (error) {
    console.error('Error getting current POS opening:', error);
    return null;
  }
};

export const validatePOSClose = async (posProfile: string): Promise<POSCloseValidationResponse> => {
  try {
    const response = await call.get<POSCloseValidationResponse>(
      'ury.ury_pos.api.validate_pos_close',
      {
        pos_profile: posProfile
      }
    );

    return response;
  } catch (error) {
    console.error('Error validating POS close status:', error);
    throw error;
  }
};

export const createPOSOpeningEntry = async (
  data: CreatePOSOpeningRequest
): Promise<POSOpeningEntry> => {
  try {
    const response = await call.post<POSOpeningEntry>(
      'ury.ury_pos.api.create_pos_opening_entry',
      {
        pos_profile: data.pos_profile,
        company: data.company,
        balance_details: JSON.stringify(data.balance_details)
      }
    );

    return response.message as POSOpeningEntry;
  } catch (error) {
    console.error('Error creating POS opening entry:', error);
    throw error;
  }
};

export const getPOSClosingPreview = async (
  posOpeningEntry: string
): Promise<POSClosingPreview> => {
  try {
    const response = await call.get<{message: POSClosingPreview}>(
      'ury.ury_pos.api.get_closing_entry_preview',
      {
        pos_opening_entry: posOpeningEntry
      }
    );

    return response.message;
  } catch (error) {
    console.error('Error getting POS closing preview:', error);
    throw error;
  }
};

export const createPOSClosingEntry = async (
  data: CreatePOSClosingRequest
): Promise<any> => {
  try {
    const response = await call.post(
      'ury.ury_pos.api.create_pos_closing_entry',
      {
        pos_opening_entry: data.pos_opening_entry,
        payment_details: JSON.stringify(data.payment_details)
      }
    );

    return response.message;
  } catch (error) {
    console.error('Error creating POS closing entry:', error);
    throw error;
  }
}; 