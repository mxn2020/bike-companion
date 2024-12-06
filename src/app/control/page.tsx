// app/control/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { Play, Pause, ChevronUp, ChevronDown } from "lucide-react";
import { useBluetoothDevice } from "@/hooks/useBluetoothDevice";
import { debounce } from 'lodash';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ErrorAlert } from "../components/ErrorAlert";

// Bluetooth UUIDs
const SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb'; // Fitness Machine Service
const CONTROL_POINT_UUID = '00002ad9-0000-1000-8000-00805f9b34fb'; // Fitness Machine Control Point
const INDOOR_BIKE_DATA_UUID = '00002ad2-0000-1000-8000-00805f9b34fb'; // Indoor Bike Data
const TRAINING_STATUS_UUID = '00002ad9-0000-1000-8000-00805f9b34fb'; // Training Status

// Request all optional services and characteristics
const OPTIONAL_SERVICES = [
    SERVICE_UUID,
    '00001818-0000-1000-8000-00805f9b34fb', // Cycling Power
    '00001816-0000-1000-8000-00805f9b34fb', // Cycling Speed and Cadence
];

interface WorkoutPreset {
    name: string;
    duration: number;
    levels: number[];
}

const WORKOUT_PRESETS: WorkoutPreset[] = [
    {
        name: "Beginner Interval",
        duration: 20,
        levels: [1, 2, 3, 2, 1, 3, 2, 1],
    },
    {
        name: "Advanced Hills",
        duration: 30,
        levels: [2, 4, 6, 8, 10, 8, 6, 4, 2],
    },
];

export default function ControlPage() {
    const { error, isConnecting, connect } = useBluetoothDevice();
    const [level, setLevel] = useState(1);
    const [isRunning, setIsRunning] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [device, setDevice] = useState<BluetoothDevice | null>(null);
    const controlCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

    const scanForDevice = async () => {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{
                    services: [SERVICE_UUID]
                }],
                optionalServices: OPTIONAL_SERVICES
            });

            device.addEventListener('gattserverdisconnected', handleDisconnect);
            setDevice(device);
            return device;
        } catch (error: any) {
            console.error('Error scanning for device:', error);
            setConnectionError(error.message);
            return null;
        }
    };

    const handleDisconnect = () => {
        console.log('Device disconnected');
        setDevice(null);
        controlCharRef.current = null;
        setConnectionError('Device disconnected');
    };

    const setupBikeCharacteristics = async (server: BluetoothRemoteGATTServer) => {
        try {
          const service = await server.getPrimaryService(SERVICE_UUID);
          
          // Log all characteristics for debugging
          const allCharacteristics = await service.getCharacteristics();
          console.log('Available characteristics:', allCharacteristics.map(char => ({
            uuid: char.uuid,
            properties: {
              write: char.properties.write,
              writeWithoutResponse: char.properties.writeWithoutResponse,
              notify: char.properties.notify,
              read: char.properties.read
            }
          })));
      
          // Get the training status characteristic (which has write permission)
          const controlPoint = await service.getCharacteristic(CONTROL_POINT_UUID);
          console.log('Control point properties:', {
            write: controlPoint.properties.write,
            writeWithoutResponse: controlPoint.properties.writeWithoutResponse,
            notify: controlPoint.properties.notify
          });
      
          // Store reference
          controlCharRef.current = controlPoint;
      
          // Set up Indoor Bike Data
          const bikeData = await service.getCharacteristic(INDOOR_BIKE_DATA_UUID);
          await bikeData.startNotifications();
          bikeData.addEventListener('characteristicvaluechanged', handleBikeData);
      
          return true;
        } catch (error: any) {
          console.error('Error setting up characteristics:', error);
          setConnectionError(error.message);
          return false;
        }
      };

    const handleBikeData = (event: Event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (value) {
            console.log('Received bike data:', value);
        }
    };

    const debouncedAdjustLevel = debounce(async (newLevel: number) => {
        if (!controlCharRef.current) return;
    
        try {
            const data = new Uint8Array([
                0x04, // Set Target Resistance Level
                newLevel // Parameter value
            ]);
    
            // Try write first, then writeWithoutResponse if available
            try {
                if (controlCharRef.current.properties.write) {
                    await controlCharRef.current.writeValue(data);
                } else if (controlCharRef.current.properties.writeWithoutResponse) {
                    await controlCharRef.current.writeValueWithoutResponse(data);
                } else {
                    throw new Error('Control point does not support any write operations');
                }
                setLevel(newLevel);
            } catch (writeError) {
                console.error('Write failed:', writeError);
                setConnectionError('Failed to adjust resistance level');
            }
        } catch (err) {
            console.error('Failed to adjust level:', err);
            setConnectionError('Failed to adjust resistance level');
        }
    }, 100);

    async function handleConnect() {
        setConnectionError(null);
        try {
            const newDevice = await scanForDevice();
            if (!newDevice) return;

            console.log('Connecting to device...');
            const server = await newDevice.gatt?.connect();
            if (!server) {
                throw new Error('Failed to connect to device');
            }

            console.log('Setting up characteristics...');
            const success = await setupBikeCharacteristics(server);
            if (!success) {
                throw new Error('Failed to set up bike characteristics');
            }

            console.log('Connection successful');
        } catch (err: any) {
            console.error('Connection failed:', err);
            setConnectionError(err.message);
        }
    }

    async function toggleStart() {
        if (!controlCharRef.current) return;
      
        const control = controlCharRef.current;
        
        try {
          // Format according to Training Status characteristic
          const data = new Uint8Array([
            isRunning ? 0x00 : 0x01  // 0x01 for Start, 0x00 for Stop
          ]);
      
          await control.writeValue(data);
          setIsRunning(!isRunning);
        } catch (err: any) {
          console.error('Failed to toggle start/stop:', err);
          setConnectionError(`Write failed: ${err.message}`);
        }
      }

    // Cleanup effect
    useEffect(() => {
        return () => {
            if (device) {
                device.removeEventListener('gattserverdisconnected', handleDisconnect);
                device.gatt?.disconnect();
            }
            controlCharRef.current = null;
        };
    }, [device]);

    // Rest of the component remains the same...
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Control</h1>
                {(error || connectionError) && (
                    <ErrorAlert
                        title="Connection Error"
                        message={connectionError || error?.message || 'Unknown error'}
                    />
                )}
                <Button
                    onClick={handleConnect}
                    disabled={!!device || isConnecting}
                >
                    {isConnecting ? "Connecting..." : device ? "Connected" : "Connect"}
                </Button>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Workout Control</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Select
                                value={selectedPreset || ''}
                                onValueChange={setSelectedPreset}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select workout preset" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WORKOUT_PRESETS.map(preset => (
                                        <SelectItem key={preset.name} value={preset.name}>
                                            {preset.name} ({preset.duration} min)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                onClick={toggleStart}
                                disabled={!controlCharRef.current}
                                className="w-full py-8 text-xl"
                            >
                                {isRunning ? (
                                    <><Pause className="mr-2" /> Stop</>
                                ) : (
                                    <><Play className="mr-2" /> Start</>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Resistance Level: {level}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center space-y-4">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => debouncedAdjustLevel(Math.min(level + 1, 20))}
                                disabled={!controlCharRef.current || level >= 20}
                            >
                                <ChevronUp />
                            </Button>

                            <div className="w-full px-4">
                                <Slider
                                    value={[level]}
                                    min={1}
                                    max={20}
                                    step={1}
                                    onValueChange={([value]) => debouncedAdjustLevel(value)}
                                    disabled={!controlCharRef.current}
                                />
                            </div>

                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => debouncedAdjustLevel(Math.max(level - 1, 1))}
                                disabled={!controlCharRef.current || level <= 1}
                            >
                                <ChevronDown />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}