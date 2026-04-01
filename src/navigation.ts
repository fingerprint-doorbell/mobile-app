import { SensorConfig } from './types';

export type RootStackParamList = {
  SensorList: undefined;
  SensorForm: { sensor?: SensorConfig };
  FingerprintList: { sensor: SensorConfig };
  PinCodeList: { sensor: SensorConfig };
};
