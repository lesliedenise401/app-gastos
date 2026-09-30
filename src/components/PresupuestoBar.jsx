import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme/theme';

export default function PresupuestoBar({ usado, total }) {
  const porcentaje =
    total > 0 ? Math.min(usado / total, 1) : 0;

  const porcentajeReal =
    total > 0 ? (usado / total) * 100 : 0;

  const excedido =
    total > 0 && usado > total;

  const porcentajeTexto = Math.round(porcentajeReal);

  return (
    <View>
      <View style={styles.encabezado}>
        <Text style={styles.etiqueta}>
          PROGRESO DEL PRESUPUESTO
        </Text>

        <Text
          style={[
            styles.porcentaje,
            {
              color: excedido
                ? colors.gasto
                : colors.cobre,
            },
          ]}
        >
          {porcentajeTexto}%
        </Text>
      </View>

      <View style={styles.barraFondo}>
        <View
          style={[
            styles.barraRelleno,
            {
              width: `${porcentaje * 100}%`,
              backgroundColor: excedido
                ? colors.gasto
                : colors.cobre,
            },
          ]}
        />
      </View>

      <View style={styles.informacion}>
        <Text style={styles.texto}>
          ${Number(usado).toFixed(0)} gastados
        </Text>

        <Text style={styles.total}>
          de ${Number(total).toFixed(0)}
        </Text>
      </View>

      {excedido && (
        <View style={styles.alerta}>
          <Text style={styles.alertaTexto}>
            Has superado tu presupuesto mensual
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  etiqueta: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    color: colors.textoClaro,
    letterSpacing: 0.7,
  },

  porcentaje: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
  },

  barraFondo: {
    height: 11,
    borderRadius: 8,
    backgroundColor: colors.papelSuave,
    overflow: 'hidden',
  },

  barraRelleno: {
    height: '100%',
    borderRadius: 8,
  },

  informacion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },

  texto: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.tintaSuave,
  },

  total: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.textoClaro,
  },

  alerta: {
    marginTop: 9,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: colors.gastoSuave,
  },

  alertaTexto: {
    fontFamily: fonts.uiBold,
    fontSize: 10,
    color: colors.gasto,
  },
});