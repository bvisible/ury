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