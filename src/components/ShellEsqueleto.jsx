import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { colors } from '../theme/theme';

export default function ShellEsqueleto() {
  return (
    <View style={styles.pantalla} accessibilityRole="progressbar" accessibilityLabel="Cargando Mi Bolsillo">
      <View style={styles.cuerpo}>
        <View style={styles.encabezado}>
          <View>
            <Text style={styles.marca}>MI BOLSILLO</Text>
            <Text style={styles.lema}>Tu dinero, bajo control</Text>
          </View>
          <View style={styles.icono} />
        </View>
        <View style={[styles.bloque, { height: 128 }]} />
        <View style={[styles.bloque, { height: 150 }]} />
        <View style={[styles.bloque, { height: 190 }]} />
      </View>

      <View style={styles.tabs}>
        {['Inicio', 'Historial', 'Ajustes'].map((t) => (
          <View key={t} style={styles.tab}>
            <View style={styles.tabIcono} />
            <Text style={styles.tabTexto}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.papel },
  cuerpo: { flex: 1, padding: 20, gap: 16 },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  marca: { fontSize: 21, fontWeight: '700', color: colors.tinta, letterSpacing: 0.5 },
  lema: { fontSize: 13, color: colors.tintaSuave, marginTop: 3 },
  icono: { width: 45, height: 45, borderRadius: 14, backgroundColor: colors.cobreSuave },
  bloque: { backgroundColor: colors.blanco, borderRadius: 18, borderWidth: 1, borderColor: colors.linea },
  tabs: {
    flexDirection: 'row',
    height: 58,
    backgroundColor: colors.blanco,
    borderTopWidth: 1,
    borderTopColor: colors.linea,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabIcono: { width: 20, height: 20, borderRadius: 6, backgroundColor: colors.linea },
  tabTexto: { fontSize: 11, color: colors.textoClaro },
});