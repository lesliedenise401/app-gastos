import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts } from '../theme/theme';

const PALETA = [
  '#3F6D73', // Azul petróleo
  '#5C8D72', // Verde salvia
  '#D46A6A', // Coral
  '#7D78A8', // Lavanda
  '#6686A0', // Azul grisáceo
  '#C49A55', // Dorado suave
];

export default function DonutChart({ datos, size = 150 }) {
  const total = Object.values(datos).reduce(
    (a, b) => a + b,
    0
  );

  const radio = size / 2 - 12;
  const circunferencia = 2 * Math.PI * radio;

  let acumulado = 0;

  const entradas = Object.entries(datos);

  return (
    <View
      style={[
        styles.contenedor,
        {
          width: size,
          height: size,
        },
      ]}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {total === 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radio}
            stroke={colors.linea}
            strokeWidth={14}
            fill="none"
          />
        ) : (
          entradas.map(([catId, monto], i) => {
            const porcion = monto / total;
            const dash = porcion * circunferencia;

            const offset =
              circunferencia - acumulado;

            acumulado += dash;

            return (
              <Circle
                key={catId}
                cx={size / 2}
                cy={size / 2}
                r={radio}
                stroke={
                  PALETA[i % PALETA.length]
                }
                strokeWidth={14}
                fill="none"
                strokeDasharray={`${dash} ${
                  circunferencia - dash
                }`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                rotation="-90"
                origin={`${size / 2}, ${size / 2}`}
              />
            );
          })
        )}
      </Svg>

      {/* Información en el centro */}
      <View style={styles.centro}>
        <Text style={styles.etiqueta}>
          TOTAL
        </Text>

        <Text
          style={styles.total}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          ${Number(total).toFixed(0)}
        </Text>

        <Text style={styles.subtexto}>
          gastos
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  centro: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '55%',
  },

  etiqueta: {
    fontFamily: fonts.uiBold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.textoClaro,
  },

  total: {
    fontFamily: fonts.monoBold,
    fontSize: 17,
    color: colors.tinta,
    marginTop: 2,
  },

  subtexto: {
    fontFamily: fonts.ui,
    fontSize: 9,
    color: colors.tintaSuave,
    marginTop: 1,
  },
});