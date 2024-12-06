// components/BluetoothAlert.tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface BluetoothAlertProps {
  message: string;
}

export function BluetoothAlert({ message }: BluetoothAlertProps) {
  return (
    <Alert className="mb-4">
      <Info className="h-4 w-4" />
      <AlertTitle>Browser Compatibility Notice</AlertTitle>
      <AlertDescription>
        {message}
        <p className="mt-2">
          Supported browsers include:
          <ul className="list-disc ml-6 mt-1">
            <li>Google Chrome (desktop & Android)</li>
            <li>Microsoft Edge (desktop)</li>
            <li>Samsung Internet (Android)</li>
          </ul>
        </p>
      </AlertDescription>
    </Alert>
  );
}