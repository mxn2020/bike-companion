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

