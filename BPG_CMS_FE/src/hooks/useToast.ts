import { toast } from 'react-hot-toast';

export const useToast = () => {
  const showSuccess = (message: string) => {
    console.log(message, {
      duration: 3000,
      position: 'top-right',
    });
  };

  const showError = (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-right',
    });
  };

  const showInfo = (message: string) => {
    toast(message, {
      duration: 3000,
      position: 'top-right',
      icon: 'ℹ️',
    });
  };

  return { showSuccess, showError, showInfo };
};
