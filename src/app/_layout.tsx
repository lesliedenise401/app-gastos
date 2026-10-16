import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useCallback } from 'react';
import {
  useFonts,
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
import { Archivo_400Regular, Archivo_700Bold } from '@expo-google-fonts/archivo';
import * as SplashScreen from 'expo-splash-screen';
import RegistroPWA from '../components/RegistroPWA';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    Archivo_400Regular,
    Archivo_700Bold,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

return (
  <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
    <RegistroPWA />

    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="agregar-gasto" />
    </Stack>
  </GestureHandlerRootView>
);
}