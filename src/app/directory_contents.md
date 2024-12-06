## Current Section File and Folder Structure:
./
├-- layout.tsx
├-- page.tsx
./monitor/
└-- page.tsx
./components/
├-- MobileNav.tsx
├-- ErrorAlert.tsx
└-- Sidebar.tsx
./fonts/
├-- GeistMonoVF.woff
└-- GeistVF.woff
./scanner/
└-- page.tsx
./control/
└-- page.tsx

## layout.tsx:
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import MobileNav from "./components/MobileNav";
import Sidebar from "./components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fitness Bike Companion",
  description: "Control and monitor your fitness bike",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "antialiased")}>
        <div className="flex h-screen">
          <Sidebar className="hidden md:flex" />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
          <MobileNav className="md:hidden fixed bottom-0 left-0 right-0" />
        </div>
      </body>
    </html>
  );
}


## page.tsx:
import Image from "next/image";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li className="mb-2">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-semibold">
              src/app/page.tsx
            </code>
            .
          </li>
          <li>Save and see your changes instantly.</li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}


## page.tsx:
// app/monitor/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { useBluetoothDevice } from "@/hooks/useBluetoothDevice";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ErrorAlert } from "../components/ErrorAlert";

// Bluetooth UUIDs
const SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb'; // Fitness Machine Service
const INDOOR_BIKE_DATA_UUID = '00002ad2-0000-1000-8000-00805f9b34fb'; // Indoor Bike Data

interface BikeMetrics {
  speed: number;
  cadence: number;
  power: number;
  timestamp: number;
}

const MAX_HISTORY_POINTS = 50;

export default function MonitorPage() {
  const { device, error, isConnecting, connect } = useBluetoothDevice();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<BikeMetrics>({
    speed: 0,
    cadence: 0,
    power: 0,
    timestamp: Date.now(),
  });
  const [metricsHistory, setMetricsHistory] = useState<BikeMetrics[]>([]);
  const bikeDataCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const setupBikeCharacteristics = async (server: BluetoothRemoteGATTServer) => {
    try {
      const service = await server.getPrimaryService(SERVICE_UUID);
      
      // Set up Indoor Bike Data notifications
      const bikeData = await service.getCharacteristic(INDOOR_BIKE_DATA_UUID);
      if (!bikeData.properties.notify) {
        throw new Error('Bike data characteristic does not support notifications');
      }

      await bikeData.startNotifications();
      bikeData.addEventListener('characteristicvaluechanged', handleBikeData);
      bikeDataCharRef.current = bikeData;

      return true;
    } catch (error: any) {
      console.error('Error setting up characteristics:', error);
      setConnectionError(error.message);
      return false;
    }
  };

  function parseBikeData(value: DataView): BikeMetrics {
    // This is a basic implementation - adjust based on your bike's data format
    let offset = 0;
    const flags = value.getUint16(offset, true); offset += 2;
    
    let speed = 0;
    let cadence = 0;
    let power = 0;

    // Check flags to determine which fields are present
    // Flags meanings will depend on your specific bike's implementation
    if (flags & 0x0001) { // Instantaneous Speed present
      speed = value.getUint16(offset, true) / 100; // Convert to km/h
      offset += 2;
    }
    
    if (flags & 0x0002) { // Average Speed present
      offset += 2; // Skip average speed
    }
    
    if (flags & 0x0004) { // Instantaneous Cadence present
      cadence = value.getUint16(offset, true) / 2; // Convert to rpm
      offset += 2;
    }

    if (flags & 0x0008) { // Instantaneous Power present
      power = value.getInt16(offset, true); // In watts
      offset += 2;
    }

    return {
      speed,
      cadence,
      power,
      timestamp: Date.now()
    };
  }

  const handleBikeData = (event: Event) => {
    const dataView = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!dataView) return;
  
    // Log the raw bytes for debugging
    const bytes = new Uint8Array(dataView.buffer);
    console.log('Raw bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
  
    try {
      // First two bytes are flags
      const flags = dataView.getUint16(0, true);
      let offset = 2;  // Start after flags
  
      let speed = 0, cadence = 0, power = 0;
  
      // Check flags bit by bit
      // Speed present (bit 0)
      if (flags & 0x0001) {
        speed = dataView.getUint16(offset, true) * 0.01; // Convert from 0.01 km/h units
        offset += 2;
      }
  
      // Average speed present (bit 1)
      if (flags & 0x0002) {
        offset += 2; // Skip average speed
      }
  
      // Cadence present (bit 2)
      if (flags & 0x0004) {
        cadence = dataView.getUint16(offset, true) * 0.5; // Convert from 0.5 rpm units
        offset += 2;
      }
  
      // Average cadence present (bit 3)
      if (flags & 0x0008) {
        offset += 2; // Skip average cadence
      }
  
      // Total distance present (bit 4)
      if (flags & 0x0010) {
        offset += 3; // Skip total distance (24 bits)
      }
  
      // Resistance level present (bit 5)
      if (flags & 0x0020) {
        offset += 2; // Skip resistance level
      }
  
      // Instantaneous power present (bit 6)
      if (flags & 0x0040) {
        power = dataView.getInt16(offset, true);
        offset += 2;
      }
  
      console.log('Parsed bike data:', { flags: flags.toString(2), speed, cadence, power });
      
      // Update metrics state with the new values
      setMetrics(prev => ({
      ...prev,
        speed,
        cadence,
        power
      }));
  
    } catch (error) {
      console.error('Error parsing bike data:', error);
    }
  };    

  async function handleConnect() {
    setConnectionError(null);
    try {
      const server = await connect([SERVICE_UUID]);
      if (server) {
        const success = await setupBikeCharacteristics(server);
        if (!success) {
          setConnectionError('Failed to set up bike characteristics');
        }
      }
    } catch (err: any) {
      console.error('Connection failed:', err);
      setConnectionError(err.message);
    }
  }

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (bikeDataCharRef.current) {
        bikeDataCharRef.current.stopNotifications().catch(console.error);
      }
      device?.gatt?.disconnect();
    };
  }, [device]);

  const chartData = metricsHistory.map(m => ({
    ...m,
    time: new Date(m.timestamp).toLocaleTimeString()
  }));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Monitor</h1>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Speed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.speed.toFixed(1)} km/h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cadence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.cadence.toFixed(0)} rpm</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Power</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.power} W</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metrics History</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12 }}
                label={{ value: 'Speed (km/h) / Cadence (rpm)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                tick={{ fontSize: 12 }}
                label={{ value: 'Power (W)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="speed"
                stroke="#8884d8"
                name="Speed"
                dot={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="cadence"
                stroke="#82ca9d"
                name="Cadence"
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="power"
                stroke="#ffc658"
                name="Power"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

## MobileNav.tsx:
// components/MobileNav.tsx

'use client'

import { FileScan, Activity, Sliders } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { icon: FileScan, label: "Scanner", href: "/scanner" },
  { icon: Activity, label: "Monitor", href: "/monitor" },
  { icon: Sliders, label: "Control", href: "/control" },
];

export default function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();
  
  return (
    <div className={cn("bg-white border-t", className)}>
      <nav className="flex justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center py-2 px-4",
                isActive ? "text-blue-600" : "text-gray-600"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}


## ErrorAlert.tsx:
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


## Sidebar.tsx:
// components/Sidebar.tsx

'use client'

import { Home, FileScan, Activity, Sliders } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: FileScan, label: "Scanner", href: "/scanner" },
  { icon: Activity, label: "Monitor", href: "/monitor" },
  { icon: Sliders, label: "Control", href: "/control" },
];

export default function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  
  return (
    <div className={cn("w-64 bg-slate-50 p-4 flex flex-col", className)}>
      <div className="font-bold text-xl mb-8">Bike Companion</div>
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg",
                isActive ? "bg-slate-200" : "hover:bg-slate-100"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}


## page.tsx:
// app/scanner/page.tsx

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useBluetoothDevice } from "@/hooks/useBluetoothDevice";
import { ServiceInfo } from "@/lib/types";
import { ErrorAlert } from "../components/ErrorAlert";

// Known GATT Service UUIDs
const KNOWN_SERVICES = {
  'fitness_machine': '00001826-0000-1000-8000-00805f9b34fb',
  'cycling_power': '00001818-0000-1000-8000-00805f9b34fb',
  'cycling_speed_and_cadence': '00001816-0000-1000-8000-00805f9b34fb',
} as const;

// Known GATT Characteristic UUIDs
const KNOWN_CHARACTERISTICS = {
  // Fitness Machine characteristics
  '00002acc-0000-1000-8000-00805f9b34fb': {
    name: 'Fitness Machine Feature',
    description: 'Describes the supported features of the fitness machine'
  },
  '00002ad2-0000-1000-8000-00805f9b34fb': {
    name: 'Indoor Bike Data',
    description: 'Speed, cadence, resistance, power and other real-time metrics'
  },
  '00002ad9-0000-1000-8000-00805f9b34fb': {
    name: 'Training Status',
    description: 'Current training status and progress'
  },
  '00002ad6-0000-1000-8000-00805f9b34fb': {
    name: 'Supported Resistance Level Range',
    description: 'Min and max resistance levels supported'
  },
  '00002ad8-0000-1000-8000-00805f9b34fb': {
    name: 'Fitness Machine Control Point',
    description: 'Control resistance, start/stop workout, etc.'
  },
  // Cycling Power characteristics
  '00002a63-0000-1000-8000-00805f9b34fb': {
    name: 'Cycling Power Measurement',
    description: 'Current power output in watts'
  },
  '00002a65-0000-1000-8000-00805f9b34fb': {
    name: 'Cycling Power Feature',
    description: 'Supported power measurement features'
  },
  // Cycling Speed and Cadence characteristics
  '00002a5b-0000-1000-8000-00805f9b34fb': {
    name: 'CSC Measurement',
    description: 'Current speed and cadence measurements'
  },
  '00002a5c-0000-1000-8000-00805f9b34fb': {
    name: 'CSC Feature',
    description: 'Supported speed and cadence features'
  }
} as const;

function getServiceName(uuid: string): string {
  const knownEntry = Object.entries(KNOWN_SERVICES).find(([_, value]) => value === uuid);
  return knownEntry ? knownEntry[0].replace(/_/g, ' ').toUpperCase() : 'Unknown Service';
}

function getCharacteristicInfo(uuid: string) {
  return KNOWN_CHARACTERISTICS[uuid as keyof typeof KNOWN_CHARACTERISTICS] || {
    name: 'Unknown Characteristic',
    description: 'Characteristic purpose unknown'
  };
}

export default function ScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ServiceInfo[]>([]);
  const { error, connect } = useBluetoothDevice();

  async function startScan() {
    try {
      setScanning(true);
      setScanResults([]);

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: Object.values(KNOWN_SERVICES)
      });

      const server = await device.gatt?.connect();
      const services = await server?.getPrimaryServices();

      if (!services) return;

      const results: ServiceInfo[] = [];
      
      for (const service of services) {
        const serviceInfo: ServiceInfo = {
          uuid: service.uuid,
          characteristics: []
        };

        try {
          const characteristics = await service.getCharacteristics();
          
          for (const char of characteristics) {
            const properties = Object.entries(char.properties)
              .filter(([_, enabled]) => enabled)
              .map(([prop]) => prop);

            serviceInfo.characteristics.push({
              uuid: char.uuid,
              properties
            });
          }
        } catch (error) {
          console.error('Error getting characteristics:', error);
        }

        results.push(serviceInfo);
      }

      setScanResults(results);
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex flex-col h-screen p-6">
      <div className="flex-none">
        <h1 className="text-2xl font-bold mb-6">Bluetooth Scanner</h1>
        
        {error && (
          <ErrorAlert
            title="Scan Error"
            message={error.message}
          />
        )}
        
        <Button 
          onClick={startScan}
          disabled={scanning}
          className="mb-6"
        >
          {scanning ? "Scanning..." : "Start Scan"}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {scanResults.map((service, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>
                  {getServiceName(service.uuid)}
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    {service.uuid}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {service.characteristics.map((char, j) => {
                  const info = getCharacteristicInfo(char.uuid);
                  return (
                    <div key={j} className="mt-4 p-4 bg-slate-50 rounded-lg">
                      <div className="font-medium">
                        {info.name}
                        <span className="text-sm font-normal text-slate-500 ml-2">
                          {char.uuid}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {info.description}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        Properties: {char.properties.join(', ')}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}



## page.tsx:
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
