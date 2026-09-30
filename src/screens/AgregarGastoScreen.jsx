import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { colors, fonts } from '../theme/theme';
import { CATEGORIAS } from '../utils/categorias';
import { useGastosStore } from '../store/useGastosStore';

export default function AgregarGastoScreen() {
  const router = useRouter();
  const { movimientoId } = useLocalSearchParams();

  const {
    movimientos,
    agregarMovimiento,
    editarMovimiento,
    eliminarMovimiento,
  } = useGastosStore();

  // Normalizamos el parámetro por si Expo Router lo recibe como arreglo
  const idMovimiento = Array.isArray(movimientoId)
    ? movimientoId[0]
    : movimientoId;

  // Buscamos el movimiento solamente si existe un ID
  const existente = idMovimiento
    ? movimientos.find((m) => String(m.id) === String(idMovimiento))
    : undefined;

  const esEdicion = Boolean(existente);

  const [tipo, setTipo] = useState(existente?.tipo ?? 'gasto');

  const [monto, setMonto] = useState(
    existente?.monto != null ? String(existente.monto) : ''
  );

  const [categoria, setCategoria] = useState(
    existente?.categoria ?? 'comida'
  );

  const [nota, setNota] = useState(
    existente?.nota ?? ''
  );

  const [fecha] = useState(
    existente?.fecha ?? new Date().toISOString()
  );

  const [sinConexion, setSinConexion] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setSinConexion(!state.isConnected);
    });

    return () => unsub();
  }, []);

  const guardar = () => {
    const montoNum = parseFloat(monto.replace(',', '.'));

    if (!montoNum || montoNum <= 0) {
      Alert.alert(
        'Falta el monto',
        'Escribe cuánto fue el movimiento.'
      );
      return;
    }

    const datos = {
      tipo,
      monto: montoNum,
      categoria,
      nota,
      fecha,
    };

    if (esEdicion && existente) {
      editarMovimiento(existente.id, datos);
    } else {
      agregarMovimiento(datos);
    }

    router.back();
  };

  const confirmarEliminar = () => {
    if (!existente) return;

    const ejecutarEliminacion = () => {
      if (!existente) return;

      eliminarMovimiento(existente.id);
      router.back();
    };

    if (Platform.OS === 'web') {
      const confirmado = window.confirm(
        '¿Seguro que quieres borrar este movimiento? No se puede deshacer.'
      );

      if (confirmado) {
        ejecutarEliminacion();
      }
    } else {
      Alert.alert(
        'Eliminar movimiento',
        '¿Seguro que quieres borrar este movimiento? No se puede deshacer.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: ejecutarEliminacion,
          },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={styles.contenedor}
      contentContainerStyle={{ padding: 20 }}
    >
      <View style={styles.cabecera}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Ionicons
            name="close"
            size={24}
            color={colors.tinta}
          />
        </Pressable>

        <Text style={styles.tituloPantalla}>
          {esEdicion
            ? 'Editar movimiento'
            : 'Nuevo movimiento'}
        </Text>

        {esEdicion ? (
          <Pressable
            onPress={confirmarEliminar}
            hitSlop={10}
          >
            <Ionicons
              name="trash-outline"
              size={22}
              color={colors.gasto}
            />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <View style={styles.ticket}>
        <View style={styles.zigzag} />

        <View style={styles.tabs}>
          <Pressable
            style={[
              styles.tab,
              tipo === 'ingreso' &&
                styles.tabActivoIngreso,
            ]}
            onPress={() => setTipo('ingreso')}
          >
            <Text
              style={[
                styles.tabTexto,
                tipo === 'ingreso' &&
                  styles.tabTextoActivo,
              ]}
            >
              Ingreso
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tab,
              tipo === 'gasto' &&
                styles.tabActivoGasto,
            ]}
            onPress={() => setTipo('gasto')}
          >
            <Text
              style={[
                styles.tabTexto,
                tipo === 'gasto' &&
                  styles.tabTextoActivo,
              ]}
            >
              Gasto
            </Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.monto}
          keyboardType="decimal-pad"
          placeholder="$0.00"
          placeholderTextColor={colors.linea}
          value={monto}
          onChangeText={setMonto}
        />

        <Text style={styles.label}>
          Categoría
        </Text>

        <View style={styles.categorias}>
          {CATEGORIAS.map((c) => (
            <Pressable
              key={c.id}
              style={[
                styles.categoriaChip,
                categoria === c.id &&
                  styles.categoriaChipActiva,
              ]}
              onPress={() => setCategoria(c.id)}
            >
              <Ionicons
                name={c.icon}
                size={18}
                color={
                  categoria === c.id
                    ? '#fff'
                    : colors.tinta
                }
              />

              <Text
                style={[
                  styles.categoriaTexto,
                  categoria === c.id && {
                    color: '#fff',
                  },
                ]}
              >
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>
          Nota (opcional)
        </Text>

        <TextInput
          style={styles.nota}
          placeholder="Ej. camión a la escuela"
          placeholderTextColor={colors.linea}
          value={nota}
          onChangeText={setNota}
        />

        {sinConexion && (
          <View style={styles.offline}>
            <Ionicons
              name="cloud-offline-outline"
              size={14}
              color={colors.cobre}
            />

            <Text style={styles.offlineTexto}>
              Guardado sin conexión
            </Text>
          </View>
        )}

        <Pressable
          style={styles.botonGuardar}
          onPress={guardar}
        >
          <Text style={styles.botonGuardarTexto}>
            {esEdicion
              ? 'Actualizar'
              : 'Guardar'}
          </Text>
        </Pressable>

        {esEdicion && (
          <Pressable
            style={styles.botonEliminar}
            onPress={confirmarEliminar}
          >
            <Ionicons
              name="trash-outline"
              size={16}
              color={colors.gasto}
            />

            <Text style={styles.botonEliminarTexto}>
              Eliminar movimiento
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colors.papel,
  },

  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  tituloPantalla: {
    fontFamily: fonts.uiBold,
    fontSize: 16,
    color: colors.tinta,
  },

  ticket: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.linea,
  },

  zigzag: {
    height: 6,
    marginBottom: 12,
    borderTopWidth: 3,
    borderColor: colors.linea,
    borderStyle: 'dashed',
  },

  tabs: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.papel,
  },

  tabActivoIngreso: {
    backgroundColor: colors.ingreso,
  },

  tabActivoGasto: {
    backgroundColor: colors.gasto,
  },

  tabTexto: {
    fontFamily: fonts.uiBold,
    color: colors.tinta,
  },

  tabTextoActivo: {
    color: '#fff',
  },

  monto: {
    fontFamily: fonts.mono,
    fontSize: 36,
    textAlign: 'center',
    color: colors.tinta,
    marginBottom: 16,
  },

  label: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.tinta,
    marginBottom: 8,
  },

  categorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },

  categoriaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.linea,
  },

  categoriaChipActiva: {
    backgroundColor: colors.cobre,
    borderColor: colors.cobre,
  },

  categoriaTexto: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.tinta,
  },

  nota: {
    fontFamily: fonts.ui,
    borderWidth: 1,
    borderColor: colors.linea,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },

  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },

  offlineTexto: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.cobre,
  },

  botonGuardar: {
    backgroundColor: colors.cobre,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  botonGuardarTexto: {
    fontFamily: fonts.uiBold,
    color: '#fff',
    fontSize: 16,
  },

  botonEliminar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },

  botonEliminarTexto: {
    fontFamily: fonts.ui,
    color: colors.gasto,
    fontSize: 13,
  },
});