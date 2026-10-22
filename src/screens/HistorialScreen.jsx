import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

import { colors, fonts } from '../theme/theme';
import { CATEGORIAS } from '../utils/categorias';
import { useGastosStore } from '../store/useGastosStore';
import TicketItem from '../components/TicketItem';
import DateField from '../components/DateField';

dayjs.locale('es');

const TIPOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'ingreso', label: 'Ingresos' },
  { id: 'gasto', label: 'Gastos' },
];

const PERIODOS = [
  { id: 'todo', label: 'Todo' },
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mesPasado', label: 'Mes pasado' },
  { id: 'custom', label: 'Rango' },
];

const dinero = (n) =>
  Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// Devuelve [inicio, fin] (dayjs o null = sin límite) para el período elegido.
function rangoDe(periodo, desde, hasta) {
  const hoy = dayjs();
  switch (periodo) {
    case 'hoy':
      return [hoy.startOf('day'), hoy.endOf('day')];
    case '7d':
      return [hoy.subtract(6, 'day').startOf('day'), hoy.endOf('day')];
    case 'mes':
      return [hoy.startOf('month'), hoy.endOf('month')];
    case 'mesPasado': {
      const m = hoy.subtract(1, 'month');
      return [m.startOf('month'), m.endOf('month')];
    }
    case 'custom':
      return [
        desde ? dayjs(desde).startOf('day') : null,
        hasta ? dayjs(hasta).endOf('day') : null,
      ];
    default:
      return [null, null];
  }
}

function tituloDia(fecha) {
  const d = dayjs(fecha);
  if (d.isSame(dayjs(), 'day')) return 'Hoy';
  if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Ayer';
  const texto = d.format('dddd D [de] MMMM');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function HistorialScreen() {
  const router = useRouter();
  const movimientos = useGastosStore((s) => s.movimientos);
  const eliminarMovimiento = useGastosStore((s) => s.eliminarMovimiento);

  const [tipo, setTipo] = useState('todos');
  const [categoria, setCategoria] = useState('todas');
  const [periodo, setPeriodo] = useState('todo');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const hayFiltros =
    tipo !== 'todos' || categoria !== 'todas' || periodo !== 'todo';

  const limpiar = () => {
    setTipo('todos');
    setCategoria('todas');
    setPeriodo('todo');
    setDesde('');
    setHasta('');
  };

  // ---- Filtrado + resumen + agrupado por día ----
  const { secciones, resumen, total } = useMemo(() => {
    const [inicio, fin] = rangoDe(periodo, desde, hasta);

    const filtrados = movimientos
      .filter((m) => {
        if (tipo !== 'todos' && m.tipo !== tipo) return false;
        if (categoria !== 'todas' && m.categoria !== categoria) return false;
        const f = dayjs(m.fecha);
        if (inicio && f.isBefore(inicio)) return false;
        if (fin && f.isAfter(fin)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const porDia = new Map();
    let ingresos = 0;
    let gastos = 0;

    filtrados.forEach((m) => {
      if (m.tipo === 'ingreso') ingresos += m.monto;
      else gastos += m.monto;

      const clave = dayjs(m.fecha).format('YYYY-MM-DD');
      if (!porDia.has(clave)) porDia.set(clave, []);
      porDia.get(clave).push(m);
    });

    const secciones = [...porDia.entries()].map(([clave, data]) => ({
      clave,
      titulo: tituloDia(clave),
      subtotal: data.reduce(
        (acc, m) => acc + (m.tipo === 'ingreso' ? m.monto : -m.monto),
        0
      ),
      data,
    }));

    return {
      secciones,
      total: filtrados.length,
      resumen: { ingresos, gastos, balance: ingresos - gastos },
    };
  }, [movimientos, tipo, categoria, periodo, desde, hasta]);

  const rangoInvalido = desde && hasta && dayjs(desde).isAfter(dayjs(hasta));

  const irAEditar = (mov) => router.push(`/agregar-gasto?movimientoId=${mov.id}`);

  const Cabecera = (
    <View>
      <View style={styles.encabezado}>
        <View>
          <Text style={styles.titulo}>Historial</Text>
          <Text style={styles.subtitulo}>
            {total} {total === 1 ? 'movimiento' : 'movimientos'}
            {hayFiltros ? ' con los filtros aplicados' : ''}
          </Text>
        </View>

        {hayFiltros && (
          <Pressable style={styles.limpiar} onPress={limpiar}>
            <Ionicons name="close-circle-outline" size={15} color={colors.cobre} />
            <Text style={styles.limpiarTexto}>Limpiar</Text>
          </Pressable>
        )}
      </View>

      {/* RESUMEN DEL FILTRO */}
      <View style={styles.resumen}>
        <Celda label="INGRESOS" valor={dinero(resumen.ingresos)} color={colors.ingreso} />
        <View style={styles.divisor} />
        <Celda label="GASTOS" valor={dinero(resumen.gastos)} color={colors.gasto} />
        <View style={styles.divisor} />
        <Celda
          label="BALANCE"
          valor={dinero(resumen.balance)}
          color={resumen.balance < 0 ? colors.gasto : colors.tinta}
        />
      </View>

      {/* FILTROS */}
      <View style={styles.filtros}>
        <Text style={styles.filtroTitulo}>TIPO</Text>
        <View style={styles.segmentado}>
          {TIPOS.map((t) => {
            const activo = tipo === t.id;
            return (
              <Pressable
                key={t.id}
                style={[
                  styles.segmento,
                  activo && {
                    backgroundColor:
                      t.id === 'ingreso'
                        ? colors.ingreso
                        : t.id === 'gasto'
                        ? colors.gasto
                        : colors.cobre,
                  },
                ]}
                onPress={() => setTipo(t.id)}
              >
                <Text style={[styles.segmentoTexto, activo && { color: '#fff' }]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.filtroTitulo}>PERÍODO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PERIODOS.map((p) => (
            <Chip
              key={p.id}
              activo={periodo === p.id}
              label={p.label}
              onPress={() => setPeriodo(p.id)}
            />
          ))}
        </ScrollView>

        {periodo === 'custom' && (
          <View style={styles.rango}>
            <View style={styles.rangoCampo}>
              <Text style={styles.rangoLabel}>Desde</Text>
              <DateField value={desde} onChange={setDesde} max={hasta || undefined} label="Fecha inicial" />
            </View>
            <View style={styles.rangoCampo}>
              <Text style={styles.rangoLabel}>Hasta</Text>
              <DateField value={hasta} onChange={setHasta} min={desde || undefined} label="Fecha final" />
            </View>
          </View>
        )}
        {rangoInvalido && (
          <Text style={styles.error}>La fecha inicial no puede ser posterior a la final.</Text>
        )}

        <Text style={styles.filtroTitulo}>CATEGORÍA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip
            activo={categoria === 'todas'}
            label="Todas"
            onPress={() => setCategoria('todas')}
          />
          {CATEGORIAS.map((c) => (
            <Chip
              key={c.id}
              activo={categoria === c.id}
              label={c.label}
              icono={c.icon}
              onPress={() => setCategoria(c.id)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={styles.contenedor}>
      <SectionList
        sections={secciones}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contenido}
        ListHeaderComponent={Cabecera}
        renderSectionHeader={({ section }) => (
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>{section.titulo}</Text>
            <Text
              style={[
                styles.seccionSubtotal,
                { color: section.subtotal < 0 ? colors.gasto : colors.ingreso },
              ]}
            >
              {section.subtotal < 0 ? '-' : '+'}
              {dinero(Math.abs(section.subtotal))}
            </Text>
          </View>
        )}
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
                name={hayFiltros ? 'search-outline' : 'receipt-outline'}
                size={28}
                color={colors.cobre}
              />
            </View>
            <Text style={styles.vacioTitulo}>
              {hayFiltros ? 'Sin resultados' : 'Aún no tienes movimientos'}
            </Text>
            <Text style={styles.vacioTexto}>
              {hayFiltros
                ? 'Ningún movimiento coincide con los filtros. Prueba con otro período o categoría.'
                : 'Cuando registres gastos o ingresos aparecerán aquí.'}
            </Text>
            {hayFiltros && (
              <Pressable style={styles.botonVacio} onPress={limpiar}>
                <Text style={styles.botonVacioTexto}>Quitar filtros</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}

function Celda({ label, valor, color }) {
  return (
    <View style={styles.celda}>
      <Text style={styles.celdaLabel}>{label}</Text>
      <Text style={[styles.celdaValor, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
    </View>
  );
}

function Chip({ label, activo, onPress, icono }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, activo && styles.chipActivo]}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
    >
      {icono ? (
        <Ionicons name={icono} size={15} color={activo ? '#fff' : colors.tinta} />
      ) : null}
      <Text style={[styles.chipTexto, activo && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.papel },
  contenido: { padding: 20, paddingBottom: 40 },

  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titulo: { fontFamily: fonts.uiBold, fontSize: 21, color: colors.tinta },
  subtitulo: { fontFamily: fonts.ui, fontSize: 12, color: colors.tintaSuave, marginTop: 3 },
  limpiar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.cobreSuave,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  limpiarTexto: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.cobre },

  resumen: {
    flexDirection: 'row',
    backgroundColor: colors.blanco,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.linea,
    paddingVertical: 14,
    marginBottom: 14,
  },
  celda: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  celdaLabel: { fontFamily: fonts.uiBold, fontSize: 9, letterSpacing: 0.8, color: colors.textoClaro },
  celdaValor: { fontFamily: fonts.monoBold, fontSize: 13, marginTop: 5 },
  divisor: { width: 1, backgroundColor: colors.linea },

  filtros: {
    backgroundColor: colors.blanco,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.linea,
    padding: 14,
    marginBottom: 18,
  },
  filtroTitulo: {
    fontFamily: fonts.uiBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textoClaro,
    marginBottom: 8,
    marginTop: 4,
  },
  segmentado: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.papelSuave,
    marginBottom: 12,
  },
  segmento: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segmentoTexto: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.tinta },

  chips: { gap: 8, paddingBottom: 4, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.linea,
    backgroundColor: colors.blanco,
  },
  chipActivo: { backgroundColor: colors.cobre, borderColor: colors.cobre },
  chipTexto: { fontFamily: fonts.ui, fontSize: 12, color: colors.tinta },

  rango: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 6 },
  rangoCampo: { flex: 1 },
  rangoLabel: { fontFamily: fonts.ui, fontSize: 11, color: colors.tintaSuave, marginBottom: 5 },
  error: { fontFamily: fonts.ui, fontSize: 11, color: colors.gasto, marginBottom: 8 },

  seccion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  seccionTitulo: { fontFamily: fonts.uiBold, fontSize: 13, color: colors.tinta },
  seccionSubtotal: { fontFamily: fonts.monoBold, fontSize: 12 },
  movimiento: { marginBottom: 10 },

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
  vacioTitulo: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.tinta, textAlign: 'center' },
  vacioTexto: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 18,
    color: colors.tintaSuave,
    textAlign: 'center',
    marginTop: 6,
  },
  botonVacio: {
    marginTop: 16,
    backgroundColor: colors.cobre,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  botonVacioTexto: { fontFamily: fonts.uiBold, fontSize: 12, color: '#fff' },
});