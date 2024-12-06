// app/debug/page.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBluetoothDevice } from "@/hooks/useBluetoothDevice";
import { ErrorAlert } from "../components/ErrorAlert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy } from "lucide-react";

// Known GATT Service UUIDs
const SERVICES = {
  FITNESS_MACHINE: '00001826-0000-1000-8000-00805f9b34fb',
  CYCLING_POWER: '00001818-0000-1000-8000-00805f9b34fb',
  CYCLING_SPEED_CADENCE: '00001816-0000-1000-8000-00805f9b34fb'
};

const CHARACTERISTICS = {
  INDOOR_BIKE_DATA: '00002ad2-0000-1000-8000-00805f9b34fb',
  CONTROL_POINT: '00002ad9-0000-1000-8000-00805f9b34fb',
  TRAINING_STATUS: '00002ad3-0000-1000-8000-00805f9b34fb'
};

interface LogEntry {
  timestamp: string;
  type: 'info' | 'error' | 'data';
  message: string;
  raw?: string;
}

export default function DebugPage() {
  const { device, error, isConnecting, connect } = useBluetoothDevice();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const characteristicsRef = useRef<{[key: string]: BluetoothRemoteGATTCharacteristic}>({});

  const addLog = (type: LogEntry['type'], message: string, raw?: string) => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      type,
      message,
      raw
    }]);
  };

  const handleBikeData = (event: Event) => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    const value = characteristic.value;
    if (!value) return;

    // Convert DataView to hex string for raw data logging
    const bytes = new Uint8Array(value.buffer);
    const rawHex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');

    addLog('data', `Received data from ${characteristic.uuid}`, rawHex);

    try {
      // Parse flags
      const flags = value.getUint16(0, true);
      let offset = 2;
      let parsedData: any = { flags: flags.toString(2) };

      // Try to parse common fields
      if (flags & 0x0001) { // Speed present
        parsedData.speed = value.getUint16(offset, true) * 0.01;
        offset += 2;
      }
      if (flags & 0x0004) { // Cadence present
        parsedData.cadence = value.getUint16(offset, true) * 0.5;
        offset += 2;
      }
      if (flags & 0x0040) { // Power present
        parsedData.power = value.getInt16(offset, true);
        offset += 2;
      }

      addLog('info', 'Parsed data: ' + JSON.stringify(parsedData));
    } catch (err) {
      addLog('error', 'Failed to parse data: ' + (err as Error).message);
    }
  };

  const setupCharacteristics = async (server: BluetoothRemoteGATTServer) => {
    try {
      const service = await server.getPrimaryService(SERVICES.FITNESS_MACHINE);
      addLog('info', 'Got Fitness Machine Service');

      // Get all characteristics
      const characteristics = await service.getCharacteristics();
      addLog('info', `Found ${characteristics.length} characteristics`);

      for (const char of characteristics) {
        addLog('info', `Characteristic ${char.uuid}:`
          + ` Write: ${char.properties.write}`
          + ` WriteWithoutResponse: ${char.properties.writeWithoutResponse}`
          + ` Notify: ${char.properties.notify}`
          + ` Read: ${char.properties.read}`);

        characteristicsRef.current[char.uuid] = char;

        if (char.properties.notify) {
          await char.startNotifications();
          char.addEventListener('characteristicvaluechanged', handleBikeData);
          addLog('info', `Started notifications for ${char.uuid}`);
        }
      }

      return true;
    } catch (error) {
      addLog('error', 'Error setting up characteristics: ' + (error as Error).message);
      return false;
    }
  };

  const handleConnect = async () => {
    setConnectionError(null);
    try {
      const server = await connect([SERVICES.FITNESS_MACHINE]);
      if (server) {
        const success = await setupCharacteristics(server);
        if (!success) {
          throw new Error('Failed to set up characteristics');
        }
      }
    } catch (err) {
      console.error('Connection failed:', err);
      setConnectionError((err as Error).message);
    }
  };

  const handleStartStop = async () => {
    const controlPoint = characteristicsRef.current[CHARACTERISTICS.CONTROL_POINT];
    if (!controlPoint) {
      addLog('error', 'Control point characteristic not found');
      return;
    }

    try {
      // Try different start/stop commands
      const commands = [
        new Uint8Array([isStarted ? 0x00 : 0x01]),  // Common format
        new Uint8Array([isStarted ? 0x07 : 0x08]),  // Alternative format
      ];

      for (const cmd of commands) {
        try {
          addLog('info', `Trying command: ${Array.from(cmd).map(b => b.toString(16)).join(' ')}`);
          if (controlPoint.properties.write) {
            await controlPoint.writeValue(cmd);
          } else if (controlPoint.properties.writeWithoutResponse) {
            await controlPoint.writeValueWithoutResponse(cmd);
          }
          setIsStarted(!isStarted);
          addLog('info', `Successfully sent ${isStarted ? 'stop' : 'start'} command`);
          break;
        } catch (cmdError) {
          addLog('error', `Command failed: ${(cmdError as Error).message}`);
        }
      }
    } catch (err) {
      addLog('error', `Failed to ${isStarted ? 'stop' : 'start'}: ${(err as Error).message}`);
    }
  };

  const copyLogs = () => {
    const logText = logs
      .map(log => `[${log.timestamp}] ${log.type}: ${log.message}${log.raw ? `\nRAW: ${log.raw}` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(logText);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      Object.values(characteristicsRef.current).forEach(char => {
        if (char.properties.notify) {
          char.stopNotifications().catch(console.error);
        }
      });
    };
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Debug</h1>
        {(error || connectionError) && (
          <ErrorAlert
            title="Connection Error"
            message={connectionError || error?.message || 'Unknown error'}
          />
        )}
        <div className="space-x-2">
          <Button onClick={copyLogs}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Logs
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!!device || isConnecting}
          >
            {isConnecting ? "Connecting..." : device ? "Connected" : "Connect"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleStartStop}
              disabled={!device}
              className="w-full"
            >
              {isStarted ? "Stop" : "Start"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] w-full rounded-md border p-4">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`mb-2 font-mono text-sm ${
                    log.type === 'error' ? 'text-red-500' :
                    log.type === 'data' ? 'text-blue-500' :
                    'text-green-500'
                  }`}
                >
                  [{log.timestamp}] {log.type}: {log.message}
                  {log.raw && (
                    <div className="ml-4 text-gray-500">
                      RAW: {log.raw}
                    </div>
                  )}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

