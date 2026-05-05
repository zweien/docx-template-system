import { toast } from "sonner";

const SUCCESS_DURATION = 3000;
const ERROR_DURATION = 5000;

export function toastSuccess(message: string) {
  toast.success(message, { duration: SUCCESS_DURATION });
}

export function toastError(message: string) {
  toast.error(message, { duration: ERROR_DURATION });
}

export function toastLoading(message: string): string | number {
  return toast.loading(message, { duration: Infinity });
}

export function toastDismiss(id: string | number) {
  toast.dismiss(id);
}

export function toastPromise<T>(
  promise: Promise<T>,
  opts: {
    loading: string;
    success: string;
    error: string;
  },
) {
  toast.promise(promise, {
    loading: opts.loading,
    success: opts.success,
    error: opts.error,
    duration: SUCCESS_DURATION,
  });
}
