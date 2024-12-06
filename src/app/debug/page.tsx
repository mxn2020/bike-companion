// app/debug/page.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBluetoothDevice } from "@/hooks/useBluetoothDevice";
import { ErrorAlert } from "../components/ErrorAlert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Bug } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Known GATT Service UUIDs
const SERVICES = {
    FITNESS_MACHINE: '00001826-0000-1000-8000-00805f9b34fb',
    CYCLING_POWER: '00001818-0000-1000-8000-00805f9b34fb',
    CYCLING_SPEED_CADENCE: '00001816-0000-1000-8000-00805f9b34fb',
    HEART_RATE: '0000180d-0000-1000-8000-00805f9b34fb'  // Add this line
};

const CHARACTERISTICS = {
    FITNESS_MACHINE_FEATURE: '00002acc-0000-1000-8000-00805f9b34fb',
    INDOOR_BIKE_DATA: '00002ad2-0000-1000-8000-00805f9b34fb',
    TRAINING_STATUS: '00002ad3-0000-1000-8000-00805f9b34fb',
    SUPPORTED_RESISTANCE_LEVEL: '00002ad6-0000-1000-8000-00805f9b34fb',
    SUPPORTED_POWER_RANGE: '00002ad8-0000-1000-8000-00805f9b34fb',
    CONTROL_POINT: '00002ad9-0000-1000-8000-00805f9b34fb',
    STATUS: '00002ada-0000-1000-8000-00805f9b34fb',
    HEART_RATE_MEASUREMENT: '00002a37-0000-1000-8000-00805f9b34fb',  // Add this line
    HEART_RATE_CONTROL_POINT: '00002a39-0000-1000-8000-00805f9b34fb' // Add this line
};

const CONTROL_COMMANDS = [
    {
        name: "Start (Format 1)",
        data: [0x01]
    },
    {
        name: "Start (Format 2)",
        data: [0x07]
    },
    {
        name: "Start (Format 3)",
        data: [0x01, 0x01]
    },
    {
        name: "Stop (Format 1)",
        data: [0x00]
    },
    {
        name: "Stop (Format 2)",
        data: [0x08]
    },
    {
        name: "Stop (Format 3)",
        data: [0x01, 0x00]
    },
    {
        name: "Resistance Level 1",
        data: [0x04, 0x01]
    },
    {
        name: "Resistance Level 5",
        data: [0x04, 0x05]
    },
    {
        name: "Resistance Level 10",
        data: [0x04, 0x0A]
    },
    {
        name: "Request Control",
        data: [0x00, 0x01]
    },
    {
        name: "Reset",
        data: [0x0B]
    }
];

// Add heart rate parsing function
const parseHeartRate = (value: DataView): number | null => {
    try {
        const flags = value.getUint8(0);
        const isFormat16Bit = (flags & 0x1) === 1;
        // Heart rate value format depends on flag bit 0
        return isFormat16Bit ? value.getUint16(1, true) : value.getUint8(1);
    } catch (err) {
        console.error('Error parsing heart rate:', err);
        return null;
    }
};

interface LogEntry {
    timestamp: string;
    type: 'info' | 'error' | 'data' | 'raw';
    message: string;
    raw?: string;
}

interface ParsedData {
    flags: string;
    rawFlags: number;
    speed?: number;
    averageSpeed?: number;
    cadence?: number;
    power?: number;
    heartRate?: number;
    [key: string]: any;
}

export default function DebugPage() {
    const { device, error, isConnecting, connect } = useBluetoothDevice();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [selectedCommand, setSelectedCommand] = useState<number>(0);
    const [autoScroll, setAutoScroll] = useState(true);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [lastParsedData, setLastParsedData] = useState<ParsedData | null>(null);
    const characteristicsRef = useRef<{ [key: string]: BluetoothRemoteGATTCharacteristic }>({});
    const scrollRef = useRef<HTMLDivElement>(null);

    const addLog = (type: LogEntry['type'], message: string, raw?: string) => {
        setLogs(prev => [...prev, {
            timestamp: new Date().toISOString(),
            type,
            message,
            raw
        }]);
    };

    const parseIndoorBikeData = (dataView: DataView): ParsedData | null => {
        try {
          const flags = dataView.getUint16(0, true);
          const parsed: ParsedData = {
            flags: flags.toString(2).padStart(16, '0'),
            rawFlags: flags
          };
      
          // Only try to parse additional data if we have enough bytes
          if (dataView.byteLength >= 4) { // Ensure we have at least flags + one value
            // For both message types, store the last value which seems to be a counter
            if (dataView.byteLength === 41) { // 00002ace message
              parsed.counter = dataView.getUint8(37); // Position of incrementing counter
            } else if (dataView.byteLength === 30) { // 00002ad2 message
              parsed.counter = dataView.getUint8(26); // Position of incrementing counter
            }
          }
      
          // Store raw bytes for debugging
          const bytes = new Uint8Array(dataView.buffer);
          parsed.rawBytes = Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
      
          return parsed;
        } catch (err) {
          console.error('Error parsing bike data:', err);
          return null;
        }
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

        addLog('raw', `Raw data from ${characteristic.uuid}:`, rawHex);

        try {
            const parsed = parseIndoorBikeData(value);
            if (parsed) {
                setLastParsedData(parsed);
                addLog('data', `Parsed data: ${JSON.stringify(parsed, null, 2)}`);
            }
        } catch (err) {
            addLog('error', `Failed to parse data: ${(err as Error).message}`);
        }
    };

    const setupCharacteristics = async (server: BluetoothRemoteGATTServer) => {

        try {
            // Set up Fitness Machine Service
            const fitnessService = await server.getPrimaryService(SERVICES.FITNESS_MACHINE);
            addLog('info', 'Got Fitness Machine Service');

            // Try to get Heart Rate Service
            try {
                const heartRateService = await server.getPrimaryService(SERVICES.HEART_RATE);
                addLog('info', 'Got Heart Rate Service');

                const heartRateMeasurement = await heartRateService.getCharacteristic(
                    CHARACTERISTICS.HEART_RATE_MEASUREMENT
                );

                if (heartRateMeasurement.properties.notify) {
                    await heartRateMeasurement.startNotifications();
                    heartRateMeasurement.addEventListener('characteristicvaluechanged', (event) => {
                        const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
                        const value = characteristic.value;
                        if (!value) return;

                        const heartRate = parseHeartRate(value);
                        if (heartRate !== null) {
                            setLastParsedData(prev => ({
                                ...prev,
                                heartRate
                            }));
                            addLog('data', `Heart Rate: ${heartRate} bpm`);
                        }

                        // Log raw data
                        const bytes = new Uint8Array(value.buffer);
                        const rawHex = Array.from(bytes)
                            .map(b => b.toString(16).padStart(2, '0'))
                            .join(' ');
                        addLog('raw', 'Heart Rate raw data:', rawHex);
                    });
                    addLog('info', 'Started heart rate notifications');
                }
            } catch (hrError) {
                addLog('info', 'Heart Rate Service not available or not supported');
            }

            // Get all characteristics
            const characteristics = await fitnessService.getCharacteristics();
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

                // Read initial values for readable characteristics
                if (char.properties.read) {
                    try {
                        const value = await char.readValue();
                        const bytes = new Uint8Array(value.buffer);
                        const rawHex = Array.from(bytes)
                            .map(b => b.toString(16).padStart(2, '0'))
                            .join(' ');
                        addLog('info', `Initial value for ${char.uuid}:`, rawHex);
                    } catch (error) {
                        addLog('error', `Failed to read ${char.uuid}: ${(error as Error).message}`);
                    }
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
          const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICES.FITNESS_MACHINE] }],
            optionalServices: [
              SERVICES.CYCLING_POWER,
              SERVICES.CYCLING_SPEED_CADENCE,
              SERVICES.HEART_RATE
            ]
          });
      
          addLog('info', 'Device selected: ' + device.name);
          
          const server = await device.gatt?.connect();
          if (!server) {
            throw new Error('Failed to connect to GATT server');
          }
      
          addLog('info', 'Connected to GATT server');
          const success = await setupCharacteristics(server);
          if (!success) {
            throw new Error('Failed to set up characteristics');
          }
        } catch (err) {
          console.error('Connection failed:', err);
          setConnectionError((err as Error).message);
          addLog('error', 'Connection failed: ' + (err as Error).message);
        }
      };

    const sendCommand = async () => {
        if (!characteristicsRef.current[CHARACTERISTICS.CONTROL_POINT]) {
            addLog('error', 'Control point not found');
            return;
        }

        const command = CONTROL_COMMANDS[selectedCommand];
        const data = new Uint8Array(command.data);

        try {
            addLog('info', `Sending command: ${command.name} (${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')})`);
            await characteristicsRef.current[CHARACTERISTICS.CONTROL_POINT].writeValue(data);
            addLog('info', 'Command sent successfully');
        } catch (err) {
            addLog('error', `Failed to send command: ${(err as Error).message}`);
        }
    };

    const clearLogs = () => {
        setLogs([]);
    };

    const copyLogs = () => {
        const logText = logs
            .map(log => `[${log.timestamp}] ${log.type}: ${log.message}${log.raw ? `\nRAW: ${log.raw}` : ''}`)
            .join('\n');
        navigator.clipboard.writeText(logText);
    };

    // Auto-scroll effect
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

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
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Connection</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={handleConnect}
                            disabled={!!device || isConnecting}
                        >
                            {isConnecting ? "Connecting..." : device ? "Connected" : "Connect"}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Control Commands</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <select
                                className="w-full p-2 border rounded"
                                value={selectedCommand}
                                onChange={(e) => setSelectedCommand(parseInt(e.target.value))}
                            >
                                {CONTROL_COMMANDS.map((cmd, index) => (
                                    <option key={index} value={index}>
                                        {cmd.name} - [{cmd.data.map(b => b.toString(16).padStart(2, '0')).join(' ')}]
                                    </option>
                                ))}
                            </select>
                            <Button
                                onClick={sendCommand}
                                disabled={!device}
                                className="w-full"
                            >
                                Send Command
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {lastParsedData && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Latest Data</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">  {/* Updated to 5 columns */}
                                <div>
                                    <div className="text-sm font-medium">Speed</div>
                                    <div className="text-2xl">{lastParsedData.speed?.toFixed(1) || '0'} km/h</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Cadence</div>
                                    <div className="text-2xl">{lastParsedData.cadence?.toFixed(0) || '0'} rpm</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Power</div>
                                    <div className="text-2xl">{lastParsedData.power || '0'} W</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Heart Rate</div>
                                    <div className="text-2xl">{lastParsedData.heartRate || '0'} bpm</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Flags</div>
                                    <div className="text-xs font-mono">{lastParsedData.flags}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Debug Logs</CardTitle>
                            <div className="space-x-2">
                                <Button variant="outline" size="sm" onClick={clearLogs}>
                                    Clear
                                </Button>
                                <Button variant="outline" size="sm" onClick={copyLogs}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAutoScroll(!autoScroll)}
                                >
                                    {autoScroll ? "Disable Auto-scroll" : "Enable Auto-scroll"}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[500px] w-full rounded-md border p-4" ref={scrollRef}>
                            {logs.map((log, index) => (
                                <div
                                    key={index}
                                    className={`mb-2 font-mono text-sm ${log.type === 'error' ? 'text-red-500' :
                                            log.type === 'data' ? 'text-blue-500' :
                                                log.type === 'raw' ? 'text-gray-500' :
                                                    'text-green-500'
                                        }`}
                                >
                                    <span className="text-gray-400">
                                        [{log.timestamp.split('T')[1].split('.')[0]}]
                                    </span>{' '}
                                    <span className="font-semibold">
                                        {log.type}:
                                    </span>{' '}
                                    {log.message}
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