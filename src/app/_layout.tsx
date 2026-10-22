import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import {
  useFonts,
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
import { Archivo_400Regular, Archivo_700Bold } from '@expo-google-fonts/archivo';
import * as SplashScreen from 'expo-splash-screen';

import RegistroPWA from '../components/RegistroPWA';
import BarraEstado from '../components/BarraEstado';
import ShellEsqueleto from '../components/ShellEsqueleto';
import { useGastosStore } from '../store/useGastosStore';

SplashScreen.preventAutoHideAsync();

const Titulo = () => (
  <Head>
    <title>Mi Bolsillo · Gestión de gastos</title>
  </Head>
);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    Archivo_400Regular,
    Archivo_700Bold,
  });

  const cargarDatos = useGastosStore((s) => s.cargarDatos);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <>
        <Titulo />
        <ShellEsqueleto />
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <Titulo />
      <RegistroPWA />

      <View style={{ flex: 1 }}>
        <BarraEstado />

        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="agregar-gasto" />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}