export interface SensorConfig {
  id: string;
  name: string;
  ipAddress: string;
  apiKey: string;
}

export interface Fingerprint {
  id: number;
  name: string;
}

export interface FingerprintTemplate {
  id: number;
  name: string;
  template: string;  // base64 encoded template data
}

export interface SensorStatus {
  connected: boolean;
  paired: boolean;
  enrolling: boolean;
  count: number;
}

export interface EnrollResponse {
  status: string;
  id: number;
  name: string;
}

export interface ImportResponse {
  status: string;
  id: number;
  name: string;
}

export interface PinCode {
  id: number;
  name: string;
}

export interface PinCodeStatus {
  enabled: boolean;
  count: number;
}
