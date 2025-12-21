import { toast } from "@/hooks/use-toast"
import { ReactNode } from 'react'

export const showToast = {
  success: (message: string | ReactNode, _options?: any) => {
    toast({
      title: "Success",
      description: message as any,
      variant: "default",
    })
  },

  error: (message: string | ReactNode, _options?: any) => {
    toast({
      title: "Error",
      description: message as any,
      variant: "destructive",
    })
  },

  info: (message: string | ReactNode, _options?: any) => {
    toast({
      title: "Info",
      description: message as any,
    })
  },

  warning: (message: string | ReactNode, _options?: any) => {
    toast({
      title: "Warning",
      description: message as any,
    })
  },
}
