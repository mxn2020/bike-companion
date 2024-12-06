// src/app/training/page.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useBluetoothDevice } from "@/hooks/useBluetoothDevice";
import { Play, Pause, ChevronUp, ChevronDown, Timer, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { debounce } from 'lodash';
import { ErrorAlert } from '../components/ErrorAlert';

// Bluetooth UUIDs
const SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';
const CONTROL_POINT_UUID = '00002ad9-0000-1000-8000-00805f9b34fb';
const INDOOR_BIKE_DATA_UUID = '00002ad2-0000-1000-8000-00805f9b34fb';

interface WorkoutMetrics {
  speed: number;
  cadence: number;
  power: number;
  timestamp: number;
}

const MAX_HISTORY_POINTS = 50;

export default function TrainingPage() {
  const { device, error, isConnecting, connect } = useBluetoothDevice();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [resistanceLevel, setResistanceLevel] = useState(1);
  const [metrics, setMetrics] = useState<WorkoutMetrics>({
    speed: 0,
    cadence: 0,
    power: 0,
    timestamp: Date.now(),
  });
  const [metricsHistory, setMetricsHistory] = useState<WorkoutMetrics[]>([]);
  const controlCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const setupBikeCharacteristics = async (server: BluetoothRemoteGATTServer) => {
    try {
      const service = await server.getPrimaryService(SERVICE_UUID);
      
      // Set up control point
      const controlPoint = await service.getCharacteristic(CONTROL_POINT_UUID);
      controlCharRef.current = controlPoint;
      
      // Set up Indoor Bike Data notifications
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
    const dataView = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!dataView) return;

    try {
      const flags = dataView.getUint16(0, true);
      let offset = 2;
      
      let speed = 0, cadence = 0, power = 0;
      
      if (flags & 0x0001) {
        speed = dataView.getUint16(offset, true) * 0.01;
        offset += 2;
      }
      
      if (flags & 0x0004) {
        cadence = dataView.getUint16(offset, true) * 0.5;
        offset += 2;
      }
      
      if (flags & 0x0040) {
        power = dataView.getInt16(offset, true);
        offset += 2;
      }

      const newMetrics = {
        speed,
        cadence,
        power,
        timestamp: Date.now()
      };

      setMetrics(newMetrics);
      setMetricsHistory(prev => {
        const updated = [...prev, newMetrics];
        return updated.slice(-MAX_HISTORY_POINTS);
      });
    } catch (error) {
      console.error('Error parsing bike data:', error);
    }
  };

  const debouncedAdjustLevel = debounce(async (newLevel: number) => {
    if (!controlCharRef.current) return;
    
    try {
      const data = new Uint8Array([0x04, newLevel]);
      await controlCharRef.current.writeValue(data);
      setResistanceLevel(newLevel);
    } catch (error) {
      console.error('Failed to adjust level:', error);
      setConnectionError('Failed to adjust resistance level');
    }
  }, 100);

  const toggleWorkout = async () => {
    if (!controlCharRef.current) return;
    
    try {
      const data = new Uint8Array([isWorkoutActive ? 0x00 : 0x01]);
      await controlCharRef.current.writeValue(data);
      setIsWorkoutActive(!isWorkoutActive);
      
      if (!isWorkoutActive) {
        // Start workout timer
        workoutTimerRef.current = setInterval(() => {
          setWorkoutDuration(prev => prev + 1);
        }, 1000);
      } else {
        // Stop workout timer
        if (workoutTimerRef.current) {
          clearInterval(workoutTimerRef.current);
        }
      }
    } catch (error) {
      console.error('Failed to toggle workout:', error);
      setConnectionError('Failed to toggle workout');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (workoutTimerRef.current) {
        clearInterval(workoutTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Training</h1>
        {(error || connectionError) && (
          <ErrorAlert
            title="Connection Error"
            message={connectionError || error?.message || 'Unknown error'}
          />
        )}
        <Button 
          onClick={() => connect([SERVICE_UUID])}
          disabled={!!device || isConnecting}
        >
          {isConnecting ? "Connecting..." : device ? "Connected" : "Connect"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Workout Control Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="w-5 h-5" />
                Workout Duration: {formatDuration(workoutDuration)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={toggleWorkout}
                disabled={!device}
                className="w-full py-8 text-xl"
              >
                {isWorkoutActive ? (
                  <><Pause className="mr-2" /> Pause Workout</>
                ) : (
                  <><Play className="mr-2" /> Start Workout</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Current Metrics Card */}
          <Card>
            <CardHeader>
              <CardTitle>Current Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Speed</div>
                  <div className="text-2xl font-bold">{metrics.speed.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">km/h</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Cadence</div>
                  <div className="text-2xl font-bold">{metrics.cadence.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">rpm</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Power</div>
                  <div className="text-2xl font-bold">{metrics.power}</div>
                  <div className="text-xs text-muted-foreground">watts</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resistance Control Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Resistance Level: {resistanceLevel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => debouncedAdjustLevel(Math.max(resistanceLevel - 1, 1))}
                  disabled={!device || resistanceLevel <= 1}
                >
                  <ChevronDown />
                </Button>
                <Slider
                  value={[resistanceLevel]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={([value]) => debouncedAdjustLevel(value)}
                  disabled={!device}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => debouncedAdjustLevel(Math.min(resistanceLevel + 1, 20))}
                  disabled={!device || resistanceLevel >= 20}
                >
                  <ChevronUp />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Chart Card */}
        <Card className="lg:row-span-3">
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp"
                  tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                  interval="preserveStartEnd"
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  labelFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="speed"
                  stroke="#8884d8"
                  name="Speed (km/h)"
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="cadence"
                  stroke="#82ca9d"
                  name="Cadence (rpm)"
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="power"
                  stroke="#ffc658"
                  name="Power (W)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

