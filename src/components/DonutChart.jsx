import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, fonts } from '../theme/theme';

const COLOR_CATEGORIA = {
  comida: '#E8833A', // Naranja
  transporte: '#2F7FC1', // Azul
  entretenimiento: '#7E57C2', // Morado
  salud: '#2E9E6B', // Verde
  servicios: '#D94F8B', // Rosa
  otros: '#7A8A93', // Gris
};


const COLOR_EXTRA = ['#E2B33C', '#26A3A3', '#B5542F'];

const VUELTA = 2 * Math.PI;
const HUECO = 0.035; 

export default function DonutChart({ datos = {}, size = 150 }) {
 
  const entradas = Object.entries(datos).filter(
    ([, monto]) => Number(monto) > 0
  );

  const total = entradas.reduce((acc, [, monto]) => acc + Number(monto), 0);

  const centro = size / 2;
  const radio = size / 2 - 12;

  const colorDe = (catId, i) =>
    COLOR_CATEGORIA[catId] || COLOR_EXTRA[i % COLOR_EXTRA.length];

 
  const punto = (angulo) => [
    centro + radio * Math.sin(angulo),
    centro - radio * Math.cos(angulo),
  ];


  let acumulado = 0;
  const arcos =
    entradas.length > 1
      ? entradas.map(([catId, monto], i) => {
          let inicio = acumulado * VUELTA;
          acumulado += Number(monto) / total;
          let fin = acumulado * VUELTA;

          
          if (fin - inicio > HUECO * 2) {
            inicio += HUECO / 2;
            fin -= HUECO / 2;
          }

          const [x0, y0] = punto(inicio);
          const [x1, y1] = punto(fin);
          const grande = fin - inicio > Math.PI ? 1 : 0;

          return {
            catId,
            color: colorDe(catId, i),
            d: `M ${x0} ${y0} A ${radio} ${radio} 0 ${grande} 1 ${x1} ${y1}`,
          };
        })
      : [];

  return (
    <View style={[styles.contenedor, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {total === 0 && (
          <Circle
            cx={centro}
            cy={centro}
            r={radio}
            stroke={colors.linea}
            strokeWidth={14}
            fill="none"
          />
        )}

        {/* Una sola categoría: aro completo */}
        {entradas.length === 1 && (
          <Circle
            cx={centro}
            cy={centro}
            r={radio}
            stroke={colorDe(entradas[0][0], 0)}
            strokeWidth={14}
            fill="none"
          />
        )}

        {/* Varias categorías: un arco por cada una */}
        {arcos.map((arco) => (
          <Path
            key={arco.catId}
            d={arco.d}
            stroke={arco.color}
            strokeWidth={14}
            fill="none"
          />
        ))}
      </Svg>

      {/* Información en el centro */}
      <View style={styles.centro}>
        <Text style={styles.etiqueta}>TOTAL</Text>

        <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
          ${Number(total).toFixed(0)}
        </Text>

        <Text style={styles.subtexto}>gastos</Text>
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