// hooks/useBluetoothDevice.ts
import { useState, useCallback, useEffect } from 'react';
import { BluetoothError } from '@/types';

export function useBluetoothDevice() {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [error, setError] = useState<BluetoothError | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async (services: string[]) => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{
          services: services
        }]
      });

      setDevice(device);
      const server = await device.gatt?.connect();
      return server;
    } catch (error: any) {
      setError({
        code: error.code || 'UNKNOWN',
        message: error.message || 'Failed to connect to device'
      });
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (device) {
      const handleDisconnect = () => {
        setDevice(null);
        setError({
          code: 'DISCONNECTED',
          message: 'Device disconnected unexpectedly'
        });
      };

      device.addEventListener('gattserverdisconnected', handleDisconnect);
      return () => {
        device.removeEventListener('gattserverdisconnected', handleDisconnect);
      };
    }
  }, [device]);

  return { device, error, isConnecting, connect };
}

