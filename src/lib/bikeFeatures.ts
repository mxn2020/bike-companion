// lib/bikeFeatures.ts

// Constants for known GATT UUIDs
export const BIKE_SERVICES = {
    FITNESS_MACHINE: '00001826-0000-1000-8000-00805f9b34fb',
    CYCLING_POWER: '00001818-0000-1000-8000-00805f9b34fb',
    CYCLING_SPEED_CADENCE: '00001816-0000-1000-8000-00805f9b34fb'
  } as const;
  
  export const BIKE_CHARACTERISTICS = {
    MACHINE_FEATURE: '00002acc-0000-1000-8000-00805f9b34fb',
    INDOOR_BIKE_DATA: '00002ad2-0000-1000-8000-00805f9b34fb',
    TRAINING_STATUS: '00002ad9-0000-1000-8000-00805f9b34fb',
    RESISTANCE_RANGE: '00002ad6-0000-1000-8000-00805f9b34fb',
    CONTROL_POINT: '00002ad8-0000-1000-8000-00805f9b34fb',
    POWER_MEASUREMENT: '00002a63-0000-1000-8000-00805f9b34fb',
    POWER_FEATURE: '00002a65-0000-1000-8000-00805f9b34fb',
    CSC_MEASUREMENT: '00002a5b-0000-1000-8000-00805f9b34fb'
  } as const;
  
  // Types for bike features and capabilities
  export interface BikeFeatures {
    hasSpeedMeasurement: boolean;
    hasCadenceMeasurement: boolean;
    hasPowerMeasurement: boolean;
    hasResistanceControl: boolean;
    minResistance: number;
    maxResistance: number;
    supportedFeatures: string[];
  }
  
  export interface BikeCharacteristics {
    controlPoint: BluetoothRemoteGATTCharacteristic | null;
    indoorBikeData: BluetoothRemoteGATTCharacteristic | null;
    powerMeasurement: BluetoothRemoteGATTCharacteristic | null;
    cscMeasurement: BluetoothRemoteGATTCharacteristic | null;
  }
  
  // Parse machine features from the feature characteristic
  function parseMachineFeatures(dataView: DataView): string[] {
    const features: string[] = [];
    const flags = dataView.getUint32(0, true);
  
    // Based on GATT specification for Fitness Machine Feature
    if (flags & 0x00000001) features.push('Average Speed');
    if (flags & 0x00000002) features.push('Cadence');
    if (flags & 0x00000004) features.push('Total Distance');
    if (flags & 0x00000008) features.push('Inclination');
    if (flags & 0x00000010) features.push('Elevation Gain');
    if (flags & 0x00000020) features.push('Pace');
    if (flags & 0x00000040) features.push('Step Count');
    if (flags & 0x00000080) features.push('Resistance Level');
    if (flags & 0x00000100) features.push('Stride Count');
    if (flags & 0x00000200) features.push('Expended Energy');
    if (flags & 0x00000400) features.push('Heart Rate');
    if (flags & 0x00000800) features.push('Metabolic Equivalent');
    if (flags & 0x00001000) features.push('Elapsed Time');
    if (flags & 0x00002000) features.push('Remaining Time');
    if (flags & 0x00004000) features.push('Power Measurement');
    
    return features;
  }
  
  // Parse resistance range from the range characteristic
  function parseResistanceRange(dataView: DataView): { min: number; max: number } {
    return {
      min: dataView.getInt16(0, true),
      max: dataView.getInt16(2, true)
    };
  }
  
  // Main setup function
  export async function setupBikeFeatures(server: BluetoothRemoteGATTServer): Promise<{
    features: BikeFeatures;
    characteristics: BikeCharacteristics;
  }> {
    // Initialize default features
    const features: BikeFeatures = {
      hasSpeedMeasurement: false,
      hasCadenceMeasurement: false,
      hasPowerMeasurement: false,
      hasResistanceControl: false,
      minResistance: 1,
      maxResistance: 20,
      supportedFeatures: []
    };
  
    // Initialize characteristics
    const characteristics: BikeCharacteristics = {
      controlPoint: null,
      indoorBikeData: null,
      powerMeasurement: null,
      cscMeasurement: null
    };
  
    try {
      // Get Fitness Machine Service
      const fitnessService = await server.getPrimaryService(BIKE_SERVICES.FITNESS_MACHINE);
  
      // Read machine features
      try {
        const featureChar = await fitnessService.getCharacteristic(BIKE_CHARACTERISTICS.MACHINE_FEATURE);
        const featureValue = await featureChar.readValue();
        features.supportedFeatures = parseMachineFeatures(featureValue);
        
        // Update basic feature flags based on supported features
        features.hasCadenceMeasurement = features.supportedFeatures.includes('Cadence');
        features.hasPowerMeasurement = features.supportedFeatures.includes('Power Measurement');
        features.hasResistanceControl = features.supportedFeatures.includes('Resistance Level');
      } catch (error) {
        console.warn('Could not read machine features:', error);
      }
  
      // Read resistance range
      try {
        const rangeChar = await fitnessService.getCharacteristic(BIKE_CHARACTERISTICS.RESISTANCE_RANGE);
        const rangeValue = await rangeChar.readValue();
        const range = parseResistanceRange(rangeValue);
        features.minResistance = range.min;
        features.maxResistance = range.max;
      } catch (error) {
        console.warn('Could not read resistance range:', error);
      }
  
      // Set up control point
      try {
        characteristics.controlPoint = await fitnessService.getCharacteristic(
          BIKE_CHARACTERISTICS.CONTROL_POINT
        );
      } catch (error) {
        console.warn('Control point not available:', error);
      }
  
      // Set up indoor bike data
      try {
        characteristics.indoorBikeData = await fitnessService.getCharacteristic(
          BIKE_CHARACTERISTICS.INDOOR_BIKE_DATA
        );
        features.hasSpeedMeasurement = true; // Indoor bike data includes speed
      } catch (error) {
        console.warn('Indoor bike data not available:', error);
      }
  
      // Try to get additional services if available
      try {
        const powerService = await server.getPrimaryService(BIKE_SERVICES.CYCLING_POWER);
        characteristics.powerMeasurement = await powerService.getCharacteristic(
          BIKE_CHARACTERISTICS.POWER_MEASUREMENT
        );
        features.hasPowerMeasurement = true;
      } catch (error) {
        console.warn('Power measurement not available:', error);
      }
  
      try {
        const cscService = await server.getPrimaryService(BIKE_SERVICES.CYCLING_SPEED_CADENCE);
        characteristics.cscMeasurement = await cscService.getCharacteristic(
          BIKE_CHARACTERISTICS.CSC_MEASUREMENT
        );
        features.hasSpeedMeasurement = true;
        features.hasCadenceMeasurement = true;
      } catch (error) {
        console.warn('CSC measurement not available:', error);
      }
  
      return { features, characteristics };
    } catch (error) {
      throw new Error('Failed to setup bike features: ' + (error as Error).message);
    }
  }
  
  // Helper function to start all available notifications
  export async function startNotifications(characteristics: BikeCharacteristics) {
    const notificationPromises = [];
  
    if (characteristics.indoorBikeData?.properties.notify) {
      notificationPromises.push(
        characteristics.indoorBikeData.startNotifications().then(() => {})
      );
    }
    if (characteristics.powerMeasurement?.properties.notify) {
      notificationPromises.push(
        characteristics.powerMeasurement.startNotifications().then(() => {})
      );
    }
    if (characteristics.cscMeasurement?.properties.notify) {
      notificationPromises.push(
        characteristics.cscMeasurement.startNotifications().then(() => {})
      );
    }
  
    await Promise.all(notificationPromises);
  }
  
  // Helper function to stop all notifications
  export async function stopNotifications(characteristics: BikeCharacteristics) {
    const notificationPromises = [];
  
    if (characteristics.indoorBikeData?.properties.notify) {
      notificationPromises.push(
        characteristics.indoorBikeData.stopNotifications().then(() => {})
      );
    }
    if (characteristics.powerMeasurement?.properties.notify) {
      notificationPromises.push(
        characteristics.powerMeasurement.stopNotifications().then(() => {})
      );
    }
    if (characteristics.cscMeasurement?.properties.notify) {
      notificationPromises.push(
        characteristics.cscMeasurement.stopNotifications().then(() => {})
      );
    }
  
    await Promise.all(notificationPromises);
  }