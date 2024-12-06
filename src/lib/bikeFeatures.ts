// lib/bikeFeatures.ts

export const BIKE_SERVICES = {
  FITNESS_MACHINE: '00001826-0000-1000-8000-00805f9b34fb',
  CYCLING_POWER: '00001818-0000-1000-8000-00805f9b34fb',
  CYCLING_SPEED_CADENCE: '00001816-0000-1000-8000-00805f9b34fb',
  HEART_RATE: '0000180d-0000-1000-8000-00805f9b34fb'
} as const;

export const BIKE_CHARACTERISTICS = {
  // Fitness Machine characteristics
  FITNESS_MACHINE_FEATURE: '00002acc-0000-1000-8000-00805f9b34fb',
  INDOOR_BIKE_DATA: '00002ad2-0000-1000-8000-00805f9b34fb',
  TRAINING_STATUS: '00002ad3-0000-1000-8000-00805f9b34fb',
  SUPPORTED_RESISTANCE_LEVEL: '00002ad6-0000-1000-8000-00805f9b34fb',
  SUPPORTED_POWER_RANGE: '00002ad8-0000-1000-8000-00805f9b34fb',
  CONTROL_POINT: '00002ad9-0000-1000-8000-00805f9b34fb',
  STATUS: '00002ada-0000-1000-8000-00805f9b34fb',
  // Heart Rate characteristics
  HEART_RATE_MEASUREMENT: '00002a37-0000-1000-8000-00805f9b34fb',
  HEART_RATE_CONTROL_POINT: '00002a39-0000-1000-8000-00805f9b34fb'
} as const;

export interface BikeFeatures {
  hasSpeedMeasurement: boolean;
  hasCadenceMeasurement: boolean;
  hasPowerMeasurement: boolean;
  hasResistanceControl: boolean;
  minResistance: number;
  maxResistance: number;
  minPower: number;
  maxPower: number;
}

export interface BikeCharacteristics {
  controlPoint: BluetoothRemoteGATTCharacteristic | null;
  indoorBikeData: BluetoothRemoteGATTCharacteristic | null;
  powerMeasurement: BluetoothRemoteGATTCharacteristic | null;
  heartRateMeasurement: BluetoothRemoteGATTCharacteristic | null;
}

// Control commands based on iConsole protocol
export const CONTROL_COMMANDS = {
  PING: new Uint8Array([0xf0, 0xa0, 0x01, 0x01, 0x92]),
  INIT_A0: new Uint8Array([0xf0, 0xa0, 0x02, 0x02, 0x94]),
  STATUS: new Uint8Array([0xf0, 0xa1, 0x01, 0x01, 0x93]),
  INIT_A3: new Uint8Array([0xf0, 0xa3, 0x01, 0x01, 0x01, 0x96]),
  START: new Uint8Array([0xf0, 0xa5, 0x01, 0x01, 0x02, 0x99]),
  STOP: new Uint8Array([0xf0, 0xa5, 0x01, 0x01, 0x04, 0x9b]),
  READ: new Uint8Array([0xf0, 0xa2, 0x01, 0x01, 0x94])
};

export function parseIndoorBikeData(dataView: DataView): {
  time?: number;
  speed?: number;
  rpm?: number;
  distance?: number;
  calories?: number;
  heartRate?: number;
  power?: number;
  level?: number;
} {
  try {
    const flags = dataView.getUint16(0, true);
    let offset = 2;
    const result: any = {};

    // Based on iConsole protocol
    if (dataView.byteLength >= 19) {  // Full data packet
      // Time calculation from iConsole: (days * 24 + hours) * 60 + minutes) * 60 + seconds
      const day = dataView.getUint8(offset) - 1; offset++;
      const hour = dataView.getUint8(offset) - 1; offset++;
      const min = dataView.getUint8(offset) - 1; offset++;
      const sec = dataView.getUint8(offset) - 1; offset++;
      result.time = ((day * 24 + hour) * 60 + min) * 60 + sec;

      // Speed (km/h * 10)
      const speed1 = dataView.getUint8(offset) - 1; offset++;
      const speed2 = dataView.getUint8(offset) - 1; offset++;
      result.speed = (speed1 * 100 + speed2) / 10;

      // RPM
      const rpm1 = dataView.getUint8(offset) - 1; offset++;
      const rpm2 = dataView.getUint8(offset) - 1; offset++;
      result.rpm = rpm1 * 100 + rpm2;

      // Distance (km * 10)
      const dist1 = dataView.getUint8(offset) - 1; offset++;
      const dist2 = dataView.getUint8(offset) - 1; offset++;
      result.distance = (dist1 * 100 + dist2) / 10;

      // Calories
      const cal1 = dataView.getUint8(offset) - 1; offset++;
      const cal2 = dataView.getUint8(offset) - 1; offset++;
      result.calories = cal1 * 100 + cal2;

      // Heart rate
      const hr1 = dataView.getUint8(offset) - 1; offset++;
      const hr2 = dataView.getUint8(offset) - 1; offset++;
      result.heartRate = hr1 * 100 + hr2;

      // Power (watts * 10)
      const power1 = dataView.getUint8(offset) - 1; offset++;
      const power2 = dataView.getUint8(offset) - 1; offset++;
      result.power = (power1 * 100 + power2) / 10;

      // Resistance level
      result.level = dataView.getUint8(offset) - 1;
    }

    return result;
  } catch (error) {
    console.error('Error parsing bike data:', error);
    return {};
  }
}

export async function setupBikeFeatures(server: BluetoothRemoteGATTServer): Promise<{
  features: BikeFeatures;
  characteristics: BikeCharacteristics;
}> {
  const features: BikeFeatures = {
    hasSpeedMeasurement: false,
    hasCadenceMeasurement: false,
    hasPowerMeasurement: false,
    hasResistanceControl: false,
    minResistance: 1,
    maxResistance: 20,
    minPower: 0,
    maxPower: 1000
  };

  const characteristics: BikeCharacteristics = {
    controlPoint: null,
    indoorBikeData: null,
    powerMeasurement: null,
    heartRateMeasurement: null
  };

  try {
    // Setup Fitness Machine Service
    const fitnessService = await server.getPrimaryService(BIKE_SERVICES.FITNESS_MACHINE);
    
    // Get control point characteristic
    try {
      characteristics.controlPoint = await fitnessService.getCharacteristic(BIKE_CHARACTERISTICS.CONTROL_POINT);
      features.hasResistanceControl = true;
    } catch (e) {
      console.log('Control point not supported');
    }

    // Get indoor bike data characteristic
    try {
      characteristics.indoorBikeData = await fitnessService.getCharacteristic(BIKE_CHARACTERISTICS.INDOOR_BIKE_DATA);
      features.hasSpeedMeasurement = true;
      features.hasCadenceMeasurement = true;
    } catch (e) {
      console.log('Indoor bike data not supported');
    }

    // Setup Cycling Power Service
    try {
      const powerService = await server.getPrimaryService(BIKE_SERVICES.CYCLING_POWER);
      characteristics.powerMeasurement = await powerService.getCharacteristic(BIKE_CHARACTERISTICS.POWER_MEASUREMENT);
      features.hasPowerMeasurement = true;
    } catch (e) {
      console.log('Power measurement not supported');
    }

    // Setup Heart Rate Service
    try {
      const heartRateService = await server.getPrimaryService(BIKE_SERVICES.HEART_RATE);
      characteristics.heartRateMeasurement = await heartRateService.getCharacteristic(BIKE_CHARACTERISTICS.HEART_RATE_MEASUREMENT);
    } catch (e) {
      console.log('Heart rate not supported');
    }

  } catch (error) {
    console.error('Error setting up bike features:', error);
  }

  return { features, characteristics };
}

export async function startNotifications(characteristics: BikeCharacteristics) {
  if (characteristics.indoorBikeData?.properties.notify) {
    await characteristics.indoorBikeData.startNotifications();
  }
  if (characteristics.powerMeasurement?.properties.notify) {
    await characteristics.powerMeasurement.startNotifications();
  }
  if (characteristics.heartRateMeasurement?.properties.notify) {
    await characteristics.heartRateMeasurement.startNotifications();
  }
}

export async function stopNotifications(characteristics: BikeCharacteristics) {
  if (characteristics.indoorBikeData?.properties.notify) {
    await characteristics.indoorBikeData.stopNotifications();
  }
  if (characteristics.powerMeasurement?.properties.notify) {
    await characteristics.powerMeasurement.stopNotifications();
  }
  if (characteristics.heartRateMeasurement?.properties.notify) {
    await characteristics.heartRateMeasurement.stopNotifications();
  }
}

