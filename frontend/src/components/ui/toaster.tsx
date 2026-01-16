"use client"

import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, Info, AlertTriangle, XCircle, Bell } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastProgress,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  const iconByVariant: Record<string, React.ReactNode> = {
    success: <CheckCircle2 className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
    warning: <AlertTriangle className="h-5 w-5" />,
    destructive: <XCircle className="h-5 w-5" />,
    default: <Bell className="h-5 w-5" />,
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-white/90">
                {iconByVariant[props.variant ?? "default"] ?? iconByVariant.default}
              </div>
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastProgress variant={props.variant} duration={props.duration} />
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
