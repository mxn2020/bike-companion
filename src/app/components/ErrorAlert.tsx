// components/ErrorAlert.tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { XCircle } from "lucide-react";

interface ErrorAlertProps {
  title: string;
  message: string;
  onClose?: () => void;
}

export function ErrorAlert({ title, message, onClose }: ErrorAlertProps) {
  return (
    <Alert variant="destructive" className="mb-4">
      <XCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
