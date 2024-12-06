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