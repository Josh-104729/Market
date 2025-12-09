import { toast, ToastOptions } from 'react-toastify'
import { ReactNode } from 'react'

export const showToast = {
  success: (message: string | ReactNode, options?: ToastOptions) => {
    toast.success(message, {
      position: 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options,
    })
  },

  error: (message: string | ReactNode, options?: ToastOptions) => {
    toast.error(message, {
      position: 'top-right',
      autoClose: 4000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options,
    })
  },

  info: (message: string | ReactNode, options?: ToastOptions) => {
    toast.info(message, {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options,
    })
  },

  warning: (message: string | ReactNode, options?: ToastOptions) => {
    toast.warning(message, {
      position: 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options,
    })
  },
}

