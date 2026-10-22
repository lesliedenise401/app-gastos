import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts } from '../theme/theme';
import { usePWA } from '../pwa/usePWA';


export default function BarraEstado() {
  const enLinea = usePWA((s) => s.enLinea);
  const actualizacionLista = usePWA((s) => s.actualizacionLista);
  const puedeInstalar = usePWA((s) => s.puedeInstalar);
  const instalada = usePWA((s) => s.instalada);
  const ocultoInstalar = usePWA((s) => s.bannerInstalarOculto);
  const aplicarActualizacion = usePWA((s) => s.aplicarActualizacion);
  const instalar = usePWA((s) => s.instalar);
  const ocultarBannerInstalar = usePWA((s) => s.ocultarBannerInstalar);

  if (Platform.OS !== 'web') return null;

  return (
    <View accessibilityLiveRegion="polite">
      {!enLinea && (
        <View style={[styles.barra, styles.offline]}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.advertencia} />
          <Text style={[styles.texto, { color: '#7A5B22' }]}>
            Sin conexión · tus datos se guardan en este dispositivo
          </Text>
        </View>
      )}

      {actualizacionLista && (
        <View style={[styles.barra, styles.info]}>
          <Ionicons name="refresh-circle-outline" size={18} color={colors.informacion} />
          <Text style={[styles.texto, { color: colors.tinta }]}>Hay una nueva versión disponible</Text>
          <Pressable style={styles.boton} onPress={aplicarActualizacion}>
            <Text style={styles.botonTexto}>Actualizar</Text>
          </Pressable>
        </View>
      )}

      {puedeInstalar && !instalada && !ocultoInstalar && (
        <View style={[styles.barra, styles.instalar]}>
          <Ionicons name="download-outline" size={18} color={colors.cobre} />
          <Text style={[styles.texto, { color: colors.tinta }]}>Instala Mi Bolsillo en tu dispositivo</Text>
          <Pressable style={styles.boton} onPress={instalar}>
            <Text style={styles.botonTexto}>Instalar</Text>
          </Pressable>
          <Pressable onPress={ocultarBannerInstalar} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={18} color={colors.tintaSuave} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  offline: { backgroundColor: colors.advertenciaSuave, borderBottomColor: '#E6D3A8' },
  info: { backgroundColor: colors.informacionSuave, borderBottomColor: '#C9DAE8' },
  instalar: { backgroundColor: colors.cobreSuave, borderBottomColor: '#BFD9DB' },
  texto: { flex: 1, fontFamily: fonts.ui, fontSize: 12 },
  boton: {
    backgroundColor: colors.cobre,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  botonTexto: { fontFamily: fonts.uiBold, fontSize: 11, color: '#fff' },
});