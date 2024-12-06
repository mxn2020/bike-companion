// app/training/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useBluetoothDevice } from "@/hooks/useBluetoothDevice";
import { Play, Pause, ChevronUp, ChevronDown, Timer, Zap, RotateCw, Heart, ArrowRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { debounce } from 'lodash';
import { ErrorAlert } from '../components/ErrorAlert';
import { 
  setupBikeFeatures, 
  startNotifications,
  stopNotifications,
  BIKE_SERVICES,
  CONTROL_COMMANDS,
  parseIndoorBikeData,
  type BikeFeatures, 
  type BikeCharacteristics 
} from '@/lib/bikeFeatures';
import { useBrowserCompatibility } from '@/hooks/useBrowserCompatibility';
import { BluetoothAlert } from '../components/BluetoothAlert';

interface WorkoutMetrics {
  time: number;
  speed: number;
  cadence: number;
  power: number;
  heartRate: number;
  distance: number;
  calories: number;
  timestamp: number;
}

interface WorkoutSummary {
  avgSpeed: number;
  avgCadence: number;
  avgPower: number;
  avgHeartRate: number;
  totalDistance: number;
  totalCalories: number;
  maxPower: number;
  maxHeartRate: number;
}

const MAX_HISTORY_POINTS = 300; // 5 minutes at 1Hz

export default function TrainingPage() {
  const { device, error, isConnecting, connect } = useBluetoothDevice();
  const { isCompatible, errorMessage } = useBrowserCompatibility();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [resistanceLevel, setResistanceLevel] = useState(1);
  const [bikeFeatures, setBikeFeatures] = useState<BikeFeatures | null>(null);
  const [bikeCharacteristics, setBikeCharacteristics] = useState<BikeCharacteristics | null>(null);
  const [metrics, setMetrics] = useState<WorkoutMetrics>({
    time: 0,
    speed: 0,
    cadence: 0,
    power: 0,
    heartRate: 0,
    distance: 0,
    calories: 0,
    timestamp: Date.now(),
  });
  const [metricsHistory, setMetricsHistory] = useState<WorkoutMetrics[]>([]);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummary>({
    avgSpeed: 0,
    avgCadence: 0,
    avgPower: 0,
    avgHeartRate: 0,
    totalDistance: 0,
    totalCalories: 0,
    maxPower: 0,
    maxHeartRate: 0,
  });
  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommandRef = useRef<number>(0);

  const handleBikeData = (event: Event) => {
    const dataView = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!dataView) return;

    try {
      const parsedData = parseIndoorBikeData(dataView);
      const newMetrics = {
        ...metrics,
        ...parsedData,
        timestamp: Date.now()
      };

      setMetrics(newMetrics);
      setMetricsHistory(prev => {
        const updated = [...prev, newMetrics];
        return updated.slice(-MAX_HISTORY_POINTS);
      });

      // Update summary statistics
      if (isWorkoutActive && prev.length > 0) {
        setWorkoutSummary(prev => ({
          avgSpeed: (prev.avgSpeed * prev.length + newMetrics.speed) / (prev.length + 1),
          avgCadence: (prev.avgCadence * prev.length + newMetrics.cadence) / (prev.length + 1),
          avgPower: (prev.avgPower * prev.length + newMetrics.power) / (prev.length + 1),
          avgHeartRate: (prev.avgHeartRate * prev.length + newMetrics.heartRate) / (prev.length + 1),
          totalDistance: newMetrics.distance,
          totalCalories: newMetrics.calories,
          maxPower: Math.max(prev.maxPower, newMetrics.power),
          maxHeartRate: Math.max(prev.maxHeartRate, newMetrics.heartRate),
        }));
      }
    } catch (error) {
      console.error('Error parsing bike data:', error);
    }
  };


  const debouncedAdjustLevel = debounce(async (newLevel: number) => {
    if (!bikeCharacteristics?.controlPoint || !bikeFeatures?.hasResistanceControl) return;
    
    try {
      // Ensure minimum time between commands (iConsole uses 500ms)
      const now = Date.now();
      if (now - lastCommandRef.current < 500) {
        return;
      }
      lastCommandRef.current = now;
  
      // Get the properly formatted command
      const command = CONTROL_COMMANDS.setResistanceLevel(newLevel);
      
      await bikeCharacteristics.controlPoint.writeValue(command);
      setResistanceLevel(newLevel);
    } catch (error) {
      console.error('Failed to adjust level:', error);
      setConnectionError('Failed to adjust resistance level');
    }
  }, 100);

  const toggleWorkout = async () => {
    if (!bikeCharacteristics?.controlPoint) return;
    
    try {
      const command = isWorkoutActive ? CONTROL_COMMANDS.STOP : CONTROL_COMMANDS.START;
      await bikeCharacteristics.controlPoint.writeValue(command);
      setIsWorkoutActive(!isWorkoutActive);
      
      if (!isWorkoutActive) {
        // Reset summary when starting new workout
        setWorkoutSummary({
          avgSpeed: 0,
          avgCadence: 0,
          avgPower: 0,
          avgHeartRate: 0,
          totalDistance: 0,
          totalCalories: 0,
          maxPower: 0,
          maxHeartRate: 0,
        });
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
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleConnect = async () => {
    try {
      const server = await connect([BIKE_SERVICES.FITNESS_MACHINE]);
      if (!server) {
        throw new Error('Failed to connect to device');
      }

      // Initialize with iConsole protocol
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
        
        {!isCompatible && errorMessage && (
          <BluetoothAlert message={errorMessage} />
        )}
        
        {(error || connectionError) && isCompatible && (
          <ErrorAlert
            title="Connection Error"
            message={connectionError || error?.message || 'Unknown error'}
          />
        )}

        {isCompatible && (
          <Button 
            onClick={handleConnect}
            disabled={!!device || isConnecting}
          >
            {isConnecting ? "Connecting..." : device ? "Connected" : "Connect"}
          </Button>
        )}
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
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <ArrowRight className="w-4 h-4" />Speed
                  </div>
                  <div className="text-2xl font-bold">{metrics.speed.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">km/h</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <RotateCw className="w-4 h-4" />Cadence
                  </div>
                  <div className="text-2xl font-bold">{metrics.cadence.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">rpm</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <Zap className="w-4 h-4" />Power
                  </div>
                  <div className="text-2xl font-bold">{metrics.power}</div>
                  <div className="text-xs text-muted-foreground">watts</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <Heart className="w-4 h-4" />Heart Rate
                  </div>
                  <div className="text-2xl font-bold">{metrics.heartRate || '--'}</div>
                  <div className="text-xs text-muted-foreground">bpm</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workout Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Workout Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Distance</div>
                  <div className="text-xl font-bold">{metrics.distance.toFixed(2)} km</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Calories</div>
                  <div className="text-xl font-bold">{metrics.calories} kcal</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Avg Power</div>
                  <div className="text-xl font-bold">{workoutSummary.avgPower.toFixed(0)} W</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Max Power</div>
                  <div className="text-xl font-bold">{workoutSummary.maxPower} W</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Avg Heart Rate</div>
                  <div className="text-xl font-bold">{workoutSummary.avgHeartRate.toFixed(0)} bpm</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Max Heart Rate</div>
                  <div className="text-xl font-bold">{workoutSummary.maxHeartRate} bpm</div>
                </div>
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

        {/* Performance Charts Card */}
        <Card className="lg:row-span-3">
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Speed & Cadence Chart */}
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp"
                      tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      yAxisId="speed"
                      label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft' }}
                    />
                    <YAxis 
                      yAxisId="cadence"
                      orientation="right"
                      label={{ value: 'Cadence (rpm)', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip 
                      labelFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                    />
                    <Line
                      yAxisId="speed"
                      type="monotone"
                      dataKey="speed"
                      stroke="#8884d8"
                      name="Speed"
                      dot={false}
                    />
                    <Line
                      yAxisId="cadence"
                      type="monotone"
                      dataKey="cadence"
                      stroke="#82ca9d"
                      name="Cadence"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Power & Heart Rate Chart */}
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp"
                      tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      yAxisId="power"
                      label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }}
                    />
                    <YAxis 
                      yAxisId="heartRate"
                      orientation="right"
                      label={{ value: 'Heart Rate (bpm)', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip 
                      labelFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
                    />
                    <Line
                      yAxisId="power"
                      type="monotone"
                      dataKey="power"
                      stroke="#ffc658"
                      name="Power"
                      dot={false}
                    />
                    {bikeFeatures?.hasHeartRateMeasurement && (
                      <Line
                        yAxisId="heartRate"
                        type="monotone"
                        dataKey="heartRate"
                        stroke="#ff8d8d"
                        name="Heart Rate"
                        dot={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}