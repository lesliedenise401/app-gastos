import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { colors, fonts } from '../theme/theme';
import { useGastosStore } from '../store/useGastosStore';
import TicketItem from '../components/TicketItem';
import PresupuestoBar from '../components/PresupuestoBar';
import DonutChart from '../components/DonutChart';
//ESto borrar para quitar el mapa
import AyudaSucursal from '../components/AyudaSucursal';

export default function InicioScreen() {
  const router = useRouter();

  const {
    cargarDatos,
    cargado,
    movimientos,
    presupuestoMensual,
    getSaldo,
    getGastoDelMes,
    getGastoPorCategoria,
    eliminarMovimiento,
  } = useGastosStore();

  useEffect(() => {
    if (!cargado) {
      cargarDatos();
    }
  }, [cargado]);

  const saldo = getSaldo(movimientos);
  const gastoMes = getGastoDelMes(movimientos);
  const porCategoria = getGastoPorCategoria(movimientos);
  const recientes = movimientos.slice(0, 5);

  const irAEditar = (mov) => {
    router.push(`/agregar-gasto?movimientoId=${mov.id}`);
  };

  const irANuevo = () => {
    router.push('/agregar-gasto');
  };

  const presupuestoRestante = Math.max(
    presupuestoMensual - gastoMes,
    0
  );

  return (
    <View style={styles.contenedor}>
      <FlatList
        data={recientes}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contenido}
        ListHeaderComponent={
          <>
            {/* ENCABEZADO */}
            <View style={styles.encabezado}>
              <View>
                <Text style={styles.saludo}>MI BOLSILLO</Text>
                <Text style={styles.subtitulo}>
                  Tu dinero, bajo control
                </Text>
              </View>

              <View style={styles.iconoEncabezado}>
                <Ionicons
                  name="wallet-outline"
                  size={22}
                  color={colors.cobre}
                />
              </View>
            </View>

            {/* TARJETA DE SALDO */}
            <View style={styles.tarjetaSaldo}>
              <View style={styles.saldoEncabezado}>
                <View>
                  <Text style={styles.saldoLabel}>
                    SALDO DISPONIBLE
                  </Text>

                  <Text style={styles.saldoDescripcion}>
                    Después de tus movimientos
                  </Text>
                </View>

                <View style={styles.iconoSaldo}>
                  <Ionicons
                    name="cash-outline"
                    size={23}
                    color={colors.cobre}
                  />
                </View>
              </View>

              <Text style={styles.saldoMonto}>
                ${saldo.toFixed(2)}
              </Text>
            </View>

            {/* PRESUPUESTO */}
            <View style={styles.tarjeta}>
              <View style={styles.tituloFila}>
                <View>
                  <Text style={styles.tarjetaTitulo}>
                    Presupuesto del mes
                  </Text>

                  <Text style={styles.tarjetaSubtitulo}>
                    Controla cuánto has gastado
                  </Text>
                </View>

                <View style={styles.iconoPequeno}>
                  <Ionicons
                    name="pie-chart-outline"
                    size={19}
                    color={colors.cobre}
                  />
                </View>
              </View>

              <PresupuestoBar
                usado={gastoMes}
                total={presupuestoMensual}
              />

              <View style={styles.presupuestoInfo}>
                <View>
                  <Text style={styles.infoLabel}>
                    GASTADO
                  </Text>

                  <Text style={styles.gastoMonto}>
                    ${gastoMes.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.infoDerecha}>
                  <Text style={styles.infoLabel}>
                    RESTANTE
                  </Text>

                  <Text style={styles.restanteMonto}>
                    ${presupuestoRestante.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            {/* CATEGORÍAS */}
            <View style={styles.tarjeta}>
              <View style={styles.tituloFila}>
                <View>
                  <Text style={styles.tarjetaTitulo}>
                    Gastos por categoría
                  </Text>

                  <Text style={styles.tarjetaSubtitulo}>
                    Distribución de tus gastos este mes
                  </Text>
                </View>

                <View style={styles.iconoPequeno}>
                  <Ionicons
                    name="analytics-outline"
                    size={19}
                    color={colors.cobre}
                  />
                </View>
              </View>

              <View style={styles.grafica}>
                <DonutChart datos={porCategoria} />
              </View>
            </View>

            {/* MOVIMIENTOS */}
            <View style={styles.movimientosEncabezado}>
              <View>
                <Text style={styles.seccionTitulo}>
                  Movimientos recientes
                </Text>

                <Text style={styles.seccionSubtitulo}>
                  Tus últimas operaciones
                </Text>
              </View>

              <Pressable
                style={styles.verTodo}
                onPress={() => router.push('/historial')}
                accessibilityRole="link"
              >
                <Text style={styles.verTodoTexto}>Ver todo</Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.cobre}
                />
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.movimiento}>
            <TicketItem
              movimiento={item}
              onEditar={irAEditar}
              onEliminar={eliminarMovimiento}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.vacio}>
            <View style={styles.iconoVacio}>
              <Ionicons
                name="receipt-outline"
                size={28}
                color={colors.cobre}
              />
            </View>

            <Text style={styles.vacioTitulo}>
              Aún no tienes movimientos
            </Text>

            <Text style={styles.vacioTexto}>
              Registra tu primer gasto o ingreso para
              comenzar a llevar el control de tu dinero.
            </Text>

            <Pressable
              style={styles.botonVacio}
              onPress={irANuevo}
            >
              <Ionicons
                name="add"
                size={19}
                color="#fff"
              />

              <Text style={styles.botonVacioTexto}>
                Registrar movimiento
              </Text>
            </Pressable>
          </View>
        }
          // Esto tambien borrar para quitarlo de el mapa
         ListFooterComponent={<AyudaSucursal />}
      />

      {/* BOTÓN AGREGAR */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && styles.fabPresionado,
        ]}
        onPress={irANuevo}
      >
        <Ionicons
          name="add"
          size={29}
          color="#fff"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colors.papel,
  },

  contenido: {
    padding: 20,
    paddingBottom: 110,
  },

  // ENCABEZADO

  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  saludo: {
    fontFamily: fonts.uiBold,
    fontSize: 21,
    color: colors.tinta,
    letterSpacing: 0.5,
  },

  subtitulo: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.tintaSuave,
    marginTop: 3,
  },

  iconoEncabezado: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: colors.cobreSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // SALDO

  tarjetaSaldo: {
    backgroundColor: colors.blanco,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.linea,
  },

  saldoEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  saldoLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.tintaSuave,
  },

  saldoDescripcion: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.textoClaro,
    marginTop: 3,
  },

  iconoSaldo: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: colors.cobreSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },

  saldoMonto: {
    fontFamily: fonts.monoBold,
    fontSize: 36,
    color: colors.tinta,
    marginTop: 20,
  },

  // TARJETAS

  tarjeta: {
    backgroundColor: colors.blanco,
    borderRadius: 18,
    padding: 17,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.linea,
  },

  tituloFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  tarjetaTitulo: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.tinta,
  },

  tarjetaSubtitulo: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.tintaSuave,
    marginTop: 3,
  },

  iconoPequeno: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.cobreSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // PRESUPUESTO

  presupuestoInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },

  infoLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    color: colors.textoClaro,
    letterSpacing: 0.8,
  },

  gastoMonto: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: colors.gasto,
    marginTop: 3,
  },

  restanteMonto: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: colors.ingreso,
    marginTop: 3,
  },

  infoDerecha: {
    alignItems: 'flex-end',
  },

  // GRÁFICA

  grafica: {
    minHeight: 155,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  graficaTexto: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  graficaTitulo: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    color: colors.tinta,
  },

  graficaSubtitulo: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.tintaSuave,
    marginTop: 2,
  },

  // MOVIMIENTOS

  movimientosEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 2,
  },

  seccionTitulo: {
    fontFamily: fonts.uiBold,
    fontSize: 17,
    color: colors.tinta,
  },

  seccionSubtitulo: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.tintaSuave,
    marginTop: 3,
  },

  contador: {
    minWidth: 29,
    height: 29,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.cobreSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },

  contadorTexto: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: colors.cobre,
  },
  
    verTodo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.cobreSuave,
    borderRadius: 10,
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 8,
  },

  verTodoTexto: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: colors.cobre,
  },

  movimiento: {
    marginBottom: 10,
  },

  // SIN MOVIMIENTOS

  vacio: {
    backgroundColor: colors.blanco,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.linea,
    padding: 24,
    alignItems: 'center',
  },

  iconoVacio: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.cobreSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  vacioTitulo: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.tinta,
    textAlign: 'center',
  },

  vacioTexto: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 18,
    color: colors.tintaSuave,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },

  botonVacio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cobre,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 6,
  },

  botonVacioTexto: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: '#fff',
  },

  // BOTÓN FLOTANTE

  fab: {
    position: 'absolute',
    right: 22,
    bottom: 25,
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: colors.cobre,
    alignItems: 'center',
    justifyContent: 'center',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 6,
  },

  fabPresionado: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
});