import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts } from '../theme/theme';
import { getCategoria } from '../utils/categorias';

export default function TicketItem({
  movimiento,
  onEditar,
  onEliminar,
}) {
  const cat = getCategoria(movimiento.categoria);
  const esIngreso = movimiento.tipo === 'ingreso';

  const renderRightActions = () => (
    <Pressable
      style={styles.accionEliminar}
      onPress={() => onEliminar(movimiento.id)}
    >
      <Ionicons
        name="trash-outline"
        size={21}
        color="#fff"
      />

      <Text style={styles.textoEliminar}>
        Eliminar
      </Text>
    </Pressable>
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <Pressable
        style={({ pressed }) => [
          styles.fila,
          pressed && styles.filaPresionada,
        ]}
        onPress={() => onEditar(movimiento)}
      >
        {/* ICONO DE CATEGORÍA */}
        <View
          style={[
            styles.iconoCategoria,
            {
              backgroundColor: esIngreso
                ? colors.ingresoSuave
                : colors.cobreSuave,
            },
          ]}
        >
          <Ionicons
            name={cat.icon}
            size={19}
            color={
              esIngreso
                ? colors.ingreso
                : colors.cobre
            }
          />
        </View>

        {/* INFORMACIÓN */}
        <View style={styles.informacion}>
          <Text
            style={styles.concepto}
            numberOfLines={1}
          >
            {cat.label}
          </Text>

          {movimiento.nota ? (
            <Text
              style={styles.nota}
              numberOfLines={1}
            >
              {movimiento.nota}
            </Text>
          ) : (
            <Text style={styles.tipo}>
              {esIngreso ? 'Ingreso' : 'Gasto'}
            </Text>
          )}
        </View>

        {/* MONTO */}
        <View style={styles.montoContainer}>
          <Text
            style={[
              styles.monto,
              {
                color: esIngreso
                  ? colors.ingreso
                  : colors.gasto,
              },
            ]}
          >
            {esIngreso ? '+' : '-'}$
            {Number(movimiento.monto).toFixed(2)}
          </Text>

          <Ionicons
            name="chevron-forward"
            size={15}
            color={colors.textoClaro}
          />
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderRadius: 15,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.linea,
  },

  filaPresionada: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  iconoCategoria: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  informacion: {
    flex: 1,
    minWidth: 0,
  },

  concepto: {
    fontFamily: fonts.uiBold,
    color: colors.tinta,
    fontSize: 13,
  },

  nota: {
    fontFamily: fonts.ui,
    color: colors.tintaSuave,
    fontSize: 11,
    marginTop: 3,
  },

  tipo: {
    fontFamily: fonts.ui,
    color: colors.textoClaro,
    fontSize: 10,
    marginTop: 3,
  },

  montoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 5,
  },

  monto: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
  },

  accionEliminar: {
    width: 82,
    marginLeft: 8,
    borderRadius: 15,
    backgroundColor: colors.gasto,
    justifyContent: 'center',
    alignItems: 'center',
  },

  textoEliminar: {
    fontFamily: fonts.uiBold,
    color: '#fff',
    fontSize: 9,
    marginTop: 3,
  },
});
