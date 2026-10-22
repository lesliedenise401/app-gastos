import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts } from '../theme/theme';
import { useGastosStore } from '../store/useGastosStore';
import { usePWA, esWeb, estaInstalada, esIOS } from '../pwa/usePWA';
import {
  notificacionesSoportadas,
  permisoNavegador,
  preferenciaActiva,
  guardarPreferencia,
  activarNotificaciones,
  notificacionDePrueba,
} from '../pwa/notificaciones';

export default function AjustesScreen() {
  return (
    <ScrollView style={styles.contenedor} contentContainerStyle={styles.contenido}>
      <Text style={styles.titulo}>Ajustes</Text>
      <Text style={styles.subtitulo}>Presupuesto, avisos e instalación</Text>

      <SeccionPresupuesto />
      {Platform.OS === 'web' && <SeccionNotificaciones />}
      {Platform.OS === 'web' && <SeccionInstalacion />}
      {Platform.OS === 'web' && <SeccionDiagnostico />}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* PRESUPUESTO                                                         */
/* ------------------------------------------------------------------ */
function SeccionPresupuesto() {
  const presupuestoMensual = useGastosStore((s) => s.presupuestoMensual);
  const setPresupuesto = useGastosStore((s) => s.setPresupuesto);
  const [texto, setTexto] = useState('');
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    setTexto(presupuestoMensual > 0 ? String(presupuestoMensual) : '');
  }, [presupuestoMensual]);

  const guardar = async () => {
    const n = parseFloat(texto.replace(',', '.'));
    await setPresupuesto(Number.isFinite(n) && n > 0 ? n : 0);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1800);
  };

  return (
    <Tarjeta icono="pie-chart-outline" titulo="Presupuesto mensual" detalle="Se reinicia cada mes">
      <TextInput
        style={styles.input}
        value={texto}
        onChangeText={setTexto}
        keyboardType="decimal-pad"
        placeholder="$0.00"
        placeholderTextColor={colors.textoClaro}
        accessibilityLabel="Presupuesto mensual"
      />
      <Boton texto={guardado ? 'Guardado ✓' : 'Guardar presupuesto'} onPress={guardar} />
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ */
/* NOTIFICACIONES                                                      */
/* ------------------------------------------------------------------ */
function SeccionNotificaciones() {
  const [permiso, setPermiso] = useState('default');
  const [activa, setActiva] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const refrescar = useCallback(async () => {
    setPermiso(permisoNavegador());
    setActiva(await preferenciaActiva());
  }, []);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  if (!notificacionesSoportadas()) {
    return (
      <Tarjeta icono="notifications-off-outline" titulo="Notificaciones" detalle="No disponibles">
        <Texto>
          Este navegador no soporta notificaciones. En iPhone, instala la app en la pantalla de
          inicio (iOS 16.4 o superior) para poder recibirlas.
        </Texto>
      </Tarjeta>
    );
  }

  const bloqueado = permiso === 'denied';
  const encendido = activa && permiso === 'granted';

  const alternar = async (valor) => {
    setMensaje('');
    if (valor) {
      const resultado = await activarNotificaciones();
      if (resultado !== 'granted') {
        setMensaje('No diste permiso. Puedes habilitarlo desde la configuración del sitio en tu navegador.');
      }
    } else {
      await guardarPreferencia(false);
    }
    refrescar();
  };

  return (
    <Tarjeta
      icono="notifications-outline"
      titulo="Notificaciones"
      detalle="Avisos cuando llegues al 80 % y al 100 % de tu presupuesto"
    >
      <View style={styles.filaSwitch}>
        <Text style={styles.switchTexto}>Activar avisos de presupuesto</Text>
        <Switch
          value={encendido}
          onValueChange={alternar}
          disabled={bloqueado}
          trackColor={{ true: colors.cobreClaro, false: colors.linea }}
          thumbColor={encendido ? colors.cobre : '#fff'}
        />
      </View>

      <Insignia
        texto={
          bloqueado
            ? 'Permiso bloqueado en el navegador'
            : permiso === 'granted'
            ? 'Permiso concedido'
            : 'Permiso pendiente'
        }
        tono={bloqueado ? 'malo' : permiso === 'granted' ? 'bueno' : 'neutro'}
      />

      {permiso === 'granted' && (
        <Boton
          secundario
          texto="Enviar notificación de prueba"
          onPress={async () => {
            const ok = await notificacionDePrueba();
            setMensaje(ok ? 'Notificación enviada.' : 'No se pudo enviar la notificación.');
          }}
        />
      )}

      {mensaje ? <Texto>{mensaje}</Texto> : null}
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ */
/* INSTALACIÓN                                                         */
/* ------------------------------------------------------------------ */
function SeccionInstalacion() {
  const puedeInstalar = usePWA((s) => s.puedeInstalar);
  const instalada = usePWA((s) => s.instalada) || estaInstalada();
  const instalar = usePWA((s) => s.instalar);

  return (
    <Tarjeta icono="download-outline" titulo="Instalar aplicación" detalle="Úsala como una app, incluso sin conexión">
      {instalada ? (
        <Insignia texto="Ya está instalada en este dispositivo" tono="bueno" />
      ) : puedeInstalar ? (
        <Boton texto="Instalar Mi Bolsillo" onPress={instalar} />
      ) : esIOS() ? (
        <Texto>
          En iPhone/iPad: toca el botón Compartir de Safari y elige «Agregar a pantalla de inicio».
        </Texto>
      ) : (
        <Texto>
          El navegador aún no ofrece la instalación. Abre el sitio en Chrome o Edge, usa la app unos
          segundos y vuelve aquí, o busca «Instalar» en el menú del navegador.
        </Texto>
      )}
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ */
/* DIAGNÓSTICO PWA                                                     */
/* ------------------------------------------------------------------ */
const ETIQUETA_SW = {
  'sin-iniciar': 'Sin iniciar',
  'no-soportado': 'No soportado',
  desarrollo: 'Desactivado en desarrollo',
  registrando: 'Registrando…',
  activo: 'Activo',
  error: 'Error al registrar',
};

function SeccionDiagnostico() {
  const enLinea = usePWA((s) => s.enLinea);
  const swEstado = usePWA((s) => s.swEstado);
  const obtenerVersionSW = usePWA((s) => s.obtenerVersionSW);
  const [info, setInfo] = useState({ build: '—', recursos: '—', manifest: '—' });

  useEffect(() => {
    if (!esWeb()) return;
    let vivo = true;

    (async () => {
      const v = await obtenerVersionSW();
      let recursos = '—';
      try {
        const nombres = await caches.keys();
        let n = 0;
        for (const nombre of nombres) n += (await (await caches.open(nombre)).keys()).length;
        recursos = `${n} archivos en ${nombres.length} cachés`;
      } catch (_) {}

      let manifest = 'No encontrado';
      try {
        const r = await fetch('/manifest.json');
        if (r.ok) manifest = `${(await r.json()).short_name} · OK`;
      } catch (_) {}

      if (vivo) setInfo({ build: v ? v.buildId : '—', recursos, manifest });
    })();

    return () => {
      vivo = false;
    };
  }, [swEstado, obtenerVersionSW]);

  const modo = estaInstalada() ? 'standalone (instalada)' : 'navegador';

  return (
    <Tarjeta icono="pulse-outline" titulo="Estado de la PWA" detalle="Diagnóstico en tiempo real">
      <Fila clave="Conexión" valor={enLinea ? 'En línea' : 'Sin conexión'} />
      <Fila clave="Manifest" valor={info.manifest} />
      <Fila clave="Service Worker" valor={ETIQUETA_SW[swEstado] || swEstado} />
      <Fila clave="Versión del shell" valor={info.build} />
      <Fila clave="Caché" valor={info.recursos} />
      <Fila clave="Modo de visualización" valor={modo} />
      <Fila clave="Almacenamiento" valor="IndexedDB (idb)" />
      <Fila clave="Renderizado" valor="HTML estático (SSG) + CSR" ultimo />
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ */
/* PIEZAS DE UI                                                        */
/* ------------------------------------------------------------------ */
function Tarjeta({ icono, titulo, detalle, children }) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.tarjetaCabecera}>
        <View style={styles.tarjetaIcono}>
          <Ionicons name={icono} size={19} color={colors.cobre} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tarjetaTitulo}>{titulo}</Text>
          {detalle ? <Text style={styles.tarjetaDetalle}>{detalle}</Text> : null}
        </View>
      </View>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

const Texto = ({ children }) => <Text style={styles.texto}>{children}</Text>;

function Boton({ texto, onPress, secundario }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        secundario && styles.botonSecundario,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.botonTexto, secundario && { color: colors.cobre }]}>{texto}</Text>
    </Pressable>
  );
}

function Insignia({ texto, tono }) {
  const paleta = {
    bueno: [colors.ingresoSuave, colors.ingreso],
    malo: [colors.gastoSuave, colors.gasto],
    neutro: [colors.papelSuave, colors.tintaSuave],
  }[tono];
  return (
    <View style={[styles.insignia, { backgroundColor: paleta[0] }]}>
      <Text style={[styles.insigniaTexto, { color: paleta[1] }]}>{texto}</Text>
    </View>
  );
}

function Fila({ clave, valor, ultimo }) {
  return (
    <View style={[styles.fila, ultimo && { borderBottomWidth: 0 }]}>
      <Text style={styles.filaClave}>{clave}</Text>
      <Text style={styles.filaValor} numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.papel },
  contenido: { padding: 20, paddingBottom: 40 },
  titulo: { fontFamily: fonts.uiBold, fontSize: 21, color: colors.tinta },
  subtitulo: { fontFamily: fonts.ui, fontSize: 12, color: colors.tintaSuave, marginTop: 3, marginBottom: 18 },

  tarjeta: {
    backgroundColor: colors.blanco,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.linea,
    padding: 17,
    marginBottom: 16,
  },
  tarjetaCabecera: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  tarjetaIcono: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.cobreSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarjetaTitulo: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.tinta },
  tarjetaDetalle: { fontFamily: fonts.ui, fontSize: 11, color: colors.tintaSuave, marginTop: 2 },

  texto: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 18, color: colors.tintaSuave },

  input: {
    fontFamily: fonts.mono,
    fontSize: 22,
    color: colors.tinta,
    backgroundColor: colors.fondoInput,
    borderWidth: 1,
    borderColor: colors.linea,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },

  boton: {
    backgroundColor: colors.fondoBoton,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botonSecundario: { backgroundColor: colors.cobreSuave },
  botonTexto: { fontFamily: fonts.uiBold, fontSize: 13, color: '#fff' },

  filaSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchTexto: { fontFamily: fonts.ui, fontSize: 13, color: colors.tinta, flex: 1, paddingRight: 12 },

  insignia: { alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  insigniaTexto: { fontFamily: fonts.uiBold, fontSize: 11 },

  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.papelSuave,
    gap: 12,
  },
  filaClave: { fontFamily: fonts.ui, fontSize: 12, color: colors.tintaSuave },
  filaValor: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.tinta, flexShrink: 1, textAlign: 'right' },
});