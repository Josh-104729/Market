import { toast } from "@/hooks/use-toast"
import { ReactNode } from 'react'

type ToastOptions = {
  duration?: number
  title?: string
}

const defaultDuration = 5000

export const showToast = {
  success: (message: string | ReactNode, options?: ToastOptions) => {
    toast({
      title: options?.title || "Success",
      description: message as any,
      variant: "success",
      duration: options?.duration ?? defaultDuration,
    })
  },

  error: (message: string | ReactNode, options?: ToastOptions) => {
    toast({
      title: options?.title || "Error",
      description: message as any,
      variant: "destructive",
      duration: options?.duration ?? defaultDuration,
    })
  },

  info: (message: string | ReactNode, options?: ToastOptions) => {
    toast({
      title: options?.title || "Info",
      description: message as any,
      variant: "info",
      duration: options?.duration ?? defaultDuration,
    })
  },

  warning: (message: string | ReactNode, options?: ToastOptions) => {
    toast({
      title: options?.title || "Warning",
      description: message as any,
      variant: "warning",
      duration: options?.duration ?? defaultDuration,
    })
  },
}
