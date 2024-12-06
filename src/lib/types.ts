// types.ts
export interface BikeMetrics {
    speed: number;
    cadence: number;
    power: number;
  }
  
  export interface BluetoothError {
    code: string;
    message: string;
  }
  
  export interface ServiceInfo {
    uuid: string;
    characteristics: CharacteristicInfo[];
  }
  
  export interface CharacteristicInfo {
    uuid: string;
    properties: string[];
  }
  