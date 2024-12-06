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
import { 
  setupBikeFeatures, 
  startNotifications,
  stopNotifications,
  type BikeFeatures, 
  type BikeCharacteristics,
  BIKE_SERVICES 
} from '@/lib/bikeFeatures';

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
  const [bikeFeatures, setBikeFeatures] = useState<BikeFeatures | null>(null);
  const [bikeCharacteristics, setBikeCharacteristics] = useState<BikeCharacteristics | null>(null);
  const [metrics, setMetrics] = useState<WorkoutMetrics>({
    speed: 0,
    cadence: 0,
    power: 0,
    timestamp: Date.now(),
  });
  const [metricsHistory, setMetricsHistory] = useState<WorkoutMetrics[]>([]);
  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleBikeData = (event: Event) => {
    const dataView = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!dataView) return;

    try {
      const flags = dataView.getUint16(0, true);
      let offset = 2;
      
      let speed = metrics.speed;
      let cadence = metrics.cadence;
      let power = metrics.power;
      
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

  const handlePowerData = (event: Event) => {
    const dataView = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!dataView) return;

    try {
      const flags = dataView.getUint16(0, true);
      const power = dataView.getInt16(2, true);
      
      setMetrics(prev => ({
        ...prev,
        power,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error parsing power data:', error);
    }
  };

  const debouncedAdjustLevel = debounce(async (newLevel: number) => {
    if (!bikeCharacteristics?.controlPoint || !bikeFeatures?.hasResistanceControl) return;
    
    try {
      const data = new Uint8Array([0x04, newLevel]);
      await bikeCharacteristics.controlPoint.writeValue(data);
      setResistanceLevel(newLevel);
    } catch (error) {
      console.error('Failed to adjust level:', error);
      setConnectionError('Failed to adjust resistance level');
    }
  }, 100);

  const toggleWorkout = async () => {
    if (!bikeCharacteristics?.controlPoint) return;
    
    try {
      const data = new Uint8Array([isWorkoutActive ? 0x00 : 0x01]);
      await bikeCharacteristics.controlPoint.writeValue(data);
      setIsWorkoutActive(!isWorkoutActive);
      
      if (!isWorkoutActive) {
        workoutTimerRef.current = setInterval(() => {
          setWorkoutDuration(prev => prev + 1);
        }, 1000);
      } else {
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

  const handleConnect = async () => {
    try {
      const server = await connect([BIKE_SERVICES.FITNESS_MACHINE]);
      if (!server) {
        throw new Error('Failed to connect to device');
      }

      const { features, characteristics } = await setupBikeFeatures(server);
      setBikeFeatures(features);
      setBikeCharacteristics(characteristics);

      // Set initial resistance range
      if (features.maxResistance) {
        setResistanceLevel(features.minResistance);
      }

      // Start notifications
      await startNotifications(characteristics);

      // Add event listeners
      if (characteristics.indoorBikeData) {
        characteristics.indoorBikeData.addEventListener(
          'characteristicvaluechanged',
          handleBikeData
        );
      }

      if (characteristics.powerMeasurement) {
        characteristics.powerMeasurement.addEventListener(
          'characteristicvaluechanged',
          handlePowerData
        );
      }

    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionError((error as Error).message);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (workoutTimerRef.current) {
        clearInterval(workoutTimerRef.current);
      }
      if (bikeCharacteristics) {
        stopNotifications(bikeCharacteristics).catch(console.error);
      }
    };
  }, [bikeCharacteristics]);

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
          onClick={handleConnect}
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
                disabled={!bikeCharacteristics?.controlPoint}
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
                {bikeFeatures?.hasSpeedMeasurement && (
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Speed</div>
                    <div className="text-2xl font-bold">{metrics.speed.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">km/h</div>
                  </div>
                )}
                {bikeFeatures?.hasCadenceMeasurement && (
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Cadence</div>
                    <div className="text-2xl font-bold">{metrics.cadence.toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground">rpm</div>
                  </div>
                )}
                {bikeFeatures?.hasPowerMeasurement && (
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Power</div>
                    <div className="text-2xl font-bold">{metrics.power}</div>
                    <div className="text-xs text-muted-foreground">watts</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resistance Control Card */}
          {bikeFeatures?.hasResistanceControl && (
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
                    onClick={() => debouncedAdjustLevel(Math.max(resistanceLevel - 1, bikeFeatures.minResistance))}
                    disabled={!device || resistanceLevel <= bikeFeatures.minResistance}
                  >
                    <ChevronDown />
                  </Button>
                  <Slider
                    value={[resistanceLevel]}
                    min={bikeFeatures.minResistance}
                    max={bikeFeatures.maxResistance}
                    step={1}
                    onValueChange={([value]) => debouncedAdjustLevel(value)}
                    disabled={!device}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => debouncedAdjustLevel(Math.min(resistanceLevel + 1, bikeFeatures.maxResistance))}
                    disabled={!device || resistanceLevel >= bikeFeatures.maxResistance}
                  >
                    <ChevronUp />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
                {bikeFeatures?.hasSpeedMeasurement && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="speed"
                    stroke="#8884d8"
                    name="Speed (km/h)"
                    dot={false}
                  />
                )}
                {bikeFeatures?.hasCadenceMeasurement && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cadence"
                    stroke="#82ca9d"
                    name="Cadence (rpm)"
                    dot={false}
                  />
                )}
                {bikeFeatures?.hasPowerMeasurement && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="power"
                    stroke="#ffc658"
                    name="Power (W)"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}