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
      {Platform.OS === 'web' && <SeccionCuenta />}
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
          Si ya la instalaste la aplicacion usala desde su icono.
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
/* ------------------------------------------------------------------ */
/* CUENTA Y SINCRONIZACIÓN                                              */
/* ------------------------------------------------------------------ */
const ESTADOS_SYNC = {
  'sin-iniciar': ['Sin iniciar', 'neutro'],
  'sin-cuenta': ['Sin cuenta', 'neutro'],
  sincronizado: ['Sincronizado', 'bueno'],
  'sin-conexion': ['Sin conexión', 'malo'],
  'sin-servidor': ['Servidor no disponible', 'neutro'],
  'sesion-vencida': ['Sesión vencida', 'malo'],
  'no-aplica': ['No disponible en esta plataforma', 'neutro'],
};

const cambios = (n) => `${n} ${n === 1 ? 'cambio' : 'cambios'}`;

// Cerrar sesión borra los datos de este dispositivo, así que siempre se pide confirmación.
// Si quedan cambios sin enviar al servidor, se avisa antes de perderlos.
async function cerrarSesionConConfirmacion(cerrarSesion) {
  const seguro = window.confirm(
    'Al cerrar sesión se borran los datos de este dispositivo. Seguirán guardados en tu cuenta del servidor. ¿Continuar?'
  );
  if (!seguro) return;

  const r = await cerrarSesion();
  if (r.ok) return;

  if (r.motivo === 'pendientes') {
    const aunAsi = window.confirm(
      `Tienes ${cambios(r.pendientes)} que todavía no se ${r.pendientes === 1 ? 'envió' : 'enviaron'} al servidor. Si cierras sesión ahora, se perderán. ¿Cerrar sesión de todos modos?`
    );
    if (aunAsi) await cerrarSesion({ forzar: true });
  }
}

function SeccionCuenta() {
  const usuario = useGastosStore((s) => s.usuario);
  const estadoSync = useGastosStore((s) => s.estadoSync);

  if (!usuario) return <FormularioCuenta usuarioVencido={null} />;
  if (estadoSync === 'sesion-vencida') return <FormularioCuenta usuarioVencido={usuario} />;
  return <CuentaActiva />;
}

// Sesión iniciada: quién es, cómo va la sincronización y cómo cerrar sesión
function CuentaActiva() {
  const usuario = useGastosStore((s) => s.usuario);
  const estadoSync = useGastosStore((s) => s.estadoSync);
  const pendientes = useGastosStore((s) => s.pendientes);
  const sincronizando = useGastosStore((s) => s.sincronizando);
  const ultimaSync = useGastosStore((s) => s.ultimaSync);
  const sincronizar = useGastosStore((s) => s.sincronizar);
  const cerrarSesion = useGastosStore((s) => s.cerrarSesion);

  const [cerrando, setCerrando] = useState(false);

  const [textoEstado, tono] = ESTADOS_SYNC[estadoSync] || [estadoSync, 'neutro'];
  const hora = ultimaSync
    ? new Date(ultimaSync).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : 'Aún no';

  const salir = async () => {
    if (cerrando) return;
    setCerrando(true);
    await cerrarSesionConConfirmacion(cerrarSesion);
    setCerrando(false);
  };

  return (
    <Tarjeta icono="person-circle-outline" titulo={usuario.nombre} detalle={usuario.correo}>
      <Insignia texto={sincronizando ? 'Sincronizando…' : textoEstado} tono={tono} />

      <Fila clave="Cambios pendientes de enviar" valor={String(pendientes)} />
      <Fila clave="Última sincronización" valor={hora} ultimo />

      <Boton texto="Sincronizar ahora" onPress={() => sincronizar()} />
      <Boton
        secundario
        texto={cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
        onPress={salir}
      />

      {estadoSync === 'sin-conexion' ? (
        <Texto>
          Sin conexión tus cambios se guardan en este dispositivo y se enviarán solos cuando
          vuelva internet.
        </Texto>
      ) : null}

      {estadoSync === 'sin-servidor' ? (
        <Texto>
          No hay un servidor disponible. Tus datos siguen guardados aquí y se enviarán cuando lo
          haya.
        </Texto>
      ) : null}

      <Texto>
        Al cerrar sesión se borran los datos de este dispositivo. Siguen guardados en tu cuenta y
        regresan cuando vuelvas a entrar.
      </Texto>
    </Tarjeta>
  );
}

// Entrar o crear una cuenta. Si la sesión venció, solo pide la contraseña de la misma cuenta.
function FormularioCuenta({ usuarioVencido }) {
  const registrar = useGastosStore((s) => s.registrar);
  const iniciarSesion = useGastosStore((s) => s.iniciarSesion);
  const cerrarSesion = useGastosStore((s) => s.cerrarSesion);
  const pendientes = useGastosStore((s) => s.pendientes);

  const [modo, setModo] = useState('entrar'); // 'entrar' | 'crear'
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const vencida = Boolean(usuarioVencido);
  const crear = !vencida && modo === 'crear';

  const enviar = async () => {
    if (ocupado) return;
    setError('');

    const correoFinal = vencida ? usuarioVencido.correo : correo.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoFinal)) {
      setError('Escribe un correo válido');
      return;
    }
    if (crear && contrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!crear && !contrasena) {
      setError('Escribe tu contraseña');
      return;
    }

    setOcupado(true);
    const r = crear
      ? await registrar({ nombre: nombre.trim(), correo: correoFinal, contrasena })
      : await iniciarSesion(correoFinal, contrasena);
    setOcupado(false);

    if (!r.ok) {
      setError(r.error);
      return;
    }
    setContrasena('');
  };

  // Con la sesión vencida, para usar otra cuenta primero hay que cerrar esta
  const usarOtraCuenta = async () => {
    if (ocupado) return;
    setOcupado(true);
    await cerrarSesionConConfirmacion(cerrarSesion);
    setOcupado(false);
  };

  return (
    <Tarjeta
      icono="person-circle-outline"
      titulo={vencida ? 'Sesión vencida' : 'Cuenta'}
      detalle={
        vencida ? usuarioVencido.correo : 'Entra o crea una cuenta para guardar tus datos en el servidor'
      }
    >
      {!vencida && (
        <View style={estilosCuenta.segmentado}>
          {[
            ['entrar', 'Entrar'],
            ['crear', 'Crear cuenta'],
          ].map(([id, etiqueta]) => (
            <Pressable
              key={id}
              style={[estilosCuenta.segmento, modo === id && estilosCuenta.segmentoActivo]}
              onPress={() => {
                setModo(id);
                setError('');
              }}
            >
              <Text style={[estilosCuenta.segmentoTexto, modo === id && { color: '#fff' }]}>
                {etiqueta}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {vencida && (
        <Texto>
          Tu sesión venció. Escribe tu contraseña para volver a entrar
          {pendientes > 0
            ? `; tus cambios pendientes (${pendientes}) se enviarán al entrar.`
            : '.'}
        </Texto>
      )}

      {crear && (
        <TextInput
          style={estilosCuenta.campo}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Tu nombre"
          placeholderTextColor={colors.textoClaro}
          autoComplete="name"
          maxLength={60}
          accessibilityLabel="Nombre"
        />
      )}

      {!vencida && (
        <TextInput
          style={estilosCuenta.campo}
          value={correo}
          onChangeText={setCorreo}
          placeholder="Correo"
          placeholderTextColor={colors.textoClaro}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          accessibilityLabel="Correo"
        />
      )}

      <TextInput
        style={estilosCuenta.campo}
        value={contrasena}
        onChangeText={setContrasena}
        placeholder={crear ? 'Contraseña (mínimo 8 caracteres)' : 'Contraseña'}
        placeholderTextColor={colors.textoClaro}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={crear ? 'new-password' : 'current-password'}
        onSubmitEditing={enviar}
        accessibilityLabel="Contraseña"
      />

      {error ? <Text style={[estilosCuenta.error]}>{error}</Text> : null}

      <Boton
        texto={ocupado ? 'Un momento…' : crear ? 'Crear cuenta' : 'Entrar'}
        onPress={enviar}
      />

      {vencida && (
        <Boton secundario texto="Cerrar sesión y usar otra cuenta" onPress={usarOtraCuenta} />
      )}

      {!vencida && (
        <Texto>
          Sin cuenta tus datos solo se guardan en este dispositivo. Con una cuenta se copian al
          servidor y cada cuenta tiene sus propios datos.
        </Texto>
      )}
    </Tarjeta>
  );
}

const estilosCuenta = StyleSheet.create({
  campo: {
    fontFamily: fonts.ui,
    fontSize: 15,
    color: colors.tinta,
    backgroundColor: colors.fondoInput,
    borderWidth: 1,
    borderColor: colors.linea,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  segmentado: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.papelSuave,
  },
  segmento: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentoActivo: { backgroundColor: colors.cobre },
  segmentoTexto: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.tinta },
  error: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 18, color: colors.gasto },
});