//Borrar todo lo de aqui para borrar el mapa 
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/theme';

const URL_MAPS =
  'https://www.google.com/maps/search/?api=1&query=Universidad+Tecnol%C3%B3gica+Fidel+Vel%C3%A1zquez+Nicol%C3%A1s+Romero';

const URL_MAPA_INSERTADO =
  'https://maps.google.com/maps?q=Universidad%20Tecnol%C3%B3gica%20Fidel%20Vel%C3%A1zquez%2C%20Nicol%C3%A1s%20Romero%2C%20Estado%20de%20M%C3%A9xico&output=embed';

export default function AyudaSucursal() {
  const abrirMapa = () => {
    if (Platform.OS === 'web') {
      window.open(URL_MAPS, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <View style={styles.icono}>
          <Ionicons
            name="location-outline"
            size={22}
            color={colors.cobre}
          />
        </View>

        <View style={styles.encabezadoTexto}>
          <Text style={styles.titulo}>¿Necesitas ayuda?</Text>
          <Text style={styles.subtitulo}>
            Consulta nuestra ubicación de referencia.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={abrirMapa}
        accessibilityRole="link"
        accessibilityLabel="Abrir ubicación de la UTFV en Google Maps"
        style={({ pressed }) => [
          styles.mapa,
          pressed && styles.mapaPresionado,
        ]}
      >
        {Platform.OS === 'web' ? (
          <iframe
            title="Ubicación de la UTFV"
            src={URL_MAPA_INSERTADO}
            width="100%"
            height="220"
            style={{
              border: 0,
              pointerEvents: 'none',
            }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <View style={styles.mapaAlternativo}>
            <Ionicons
              name="map-outline"
              size={42}
              color={colors.cobre}
            />
            <Text style={styles.alternativoTitulo}>
              Universidad Tecnológica Fidel Velázquez
            </Text>
            <Text style={styles.alternativoTexto}>
              Toca para abrir la ubicación en Google Maps.
            </Text>
          </View>
        )}

        <View style={styles.etiquetaMapa}>
          <Ionicons name="navigate" size={15} color="#FFFFFF" />
          <Text style={styles.etiquetaTexto}>Ver ubicación</Text>
        </View>
      </Pressable>

      <Text style={styles.nombre}>
        Universidad Tecnológica Fidel Velázquez
      </Text>

      <Text style={styles.direccion}>
        Av. Emiliano Zapata s/n, Nicolás Romero, Estado de México.
      </Text>

      <Text style={styles.pista}>
        Toca el mapa para abrir Google Maps.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.blanco,
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.linea,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  icono: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cobreSuave,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  encabezadoTexto: {
    flex: 1,
  },
  titulo: {
    fontFamily: fonts.uiBold,
    fontSize: 17,
    color: colors.tinta,
  },
  subtitulo: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.tintaSuave,
    marginTop: 3,
  },
  mapa: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.papel,
    position: 'relative',
    justifyContent: 'center',
  },
  mapaPresionado: {
    opacity: 0.85,
  },
  mapaAlternativo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  alternativoTitulo: {
    color: colors.tinta,
    fontFamily: fonts.uiBold,
    textAlign: 'center',
    marginTop: 10,
  },
  alternativoTexto: {
    color: colors.tintaSuave,
    fontFamily: fonts.ui,
    textAlign: 'center',
    marginTop: 6,
  },
  etiquetaMapa: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cobre,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  etiquetaTexto: {
    color: '#FFFFFF',
    fontFamily: fonts.uiBold,
    fontSize: 12,
  },
  nombre: {
    color: colors.tinta,
    fontFamily: fonts.uiBold,
    fontSize: 15,
    marginTop: 14,
  },
  direccion: {
    color: colors.tintaSuave,
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  pista: {
    color: colors.cobre,
    fontFamily: fonts.uiBold,
    fontSize: 12,
    marginTop: 10,
  },
});
