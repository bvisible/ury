import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from './ui';
import POSOpeningFormDialog from './POSOpeningFormDialog';
import { usePOSStore } from '../store/pos-store';

interface POSOpeningDialogProps {
  onReload: () => void;
  type: 'opening' | 'closing';
}

const POSOpeningDialog = ({ onReload, type }: POSOpeningDialogProps) => {
  const { posProfile } = usePOSStore();
  const isOpeningIssue = type === 'opening';

  // For opening issues, render the inline form dialog
  if (isOpeningIssue && posProfile) {
    return (
      <POSOpeningFormDialog
        company={posProfile.company}
        posProfile={posProfile.name}
        onSuccess={onReload}
      />
    );
  }

  // For closing issues, render the error message dialog
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-6 bg-orange-100">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Previous POS Not Closed
          </h2>

          {/* Message */}
          <p className="text-gray-600 mb-8 text-lg">
            Please close the previous POS Entry to continue.
          </p>

          {/* Reload Button */}
          <Button
            onClick={onReload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  );
};

export default POSOpeningDialog; 