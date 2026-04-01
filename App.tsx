import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from './src/navigation';
import SensorListScreen from './src/screens/SensorListScreen';
import SensorFormScreen from './src/screens/SensorFormScreen';
import FingerprintListScreen from './src/screens/FingerprintListScreen';
import PinCodeListScreen from './src/screens/PinCodeListScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="SensorList"
          screenOptions={{
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#333',
            headerTitleStyle: { fontWeight: '600' },
            headerShadowVisible: false,
            headerBackTitle: 'Back',
            contentStyle: { backgroundColor: '#f5f5f5' },
          }}
        >
          <Stack.Screen
            name="SensorList"
            component={SensorListScreen}
            options={{ title: 'My Doorbells' }}
          />
          <Stack.Screen
            name="SensorForm"
            component={SensorFormScreen}
            options={{ title: 'Add Doorbell' }}
          />
          <Stack.Screen
            name="FingerprintList"
            component={FingerprintListScreen}
            options={{ title: 'Fingerprints' }}
          />
          <Stack.Screen
            name="PinCodeList"
            component={PinCodeListScreen}
            options={{ title: 'PIN Codes' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
