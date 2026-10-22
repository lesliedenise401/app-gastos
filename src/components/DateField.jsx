import React, { useEffect, useState } from 'react';
import { Platform, TextInput, StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { colors, fonts } from '../theme/theme';

dayjs.extend(customParseFormat);

const FORMATO = 'YYYY-MM-DD';

/**
 * Campo de fecha multiplataforma.
 *  - Web: <input type="date"> nativo del navegador (calendario del sistema).
 *  - iOS/Android: campo de texto AAAA-MM-DD.
 * `value` y `onChange` usan siempre 'YYYY-MM-DD'. onChange solo se dispara con una
 * fecha válida o con '' (campo vacío), nunca con texto a medias.
 */
export default function DateField({ value, onChange, min, max, label = 'Fecha' }) {
  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'date',
      value: value || '',
      min,
      max,
      'aria-label': label,
      onChange: (e) => onChange(e.target.value),
      style: {
        fontFamily: fonts.ui,
        fontSize: 14,
        color: colors.tinta,
        backgroundColor: colors.fondoInput,
        border: `1px solid ${colors.linea}`,
        borderRadius: 8,
        padding: '9px 10px',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: 40,
      },
    });
  }
  return <CampoTexto value={value} onChange={onChange} label={label} />;
}

function CampoTexto({ value, onChange, label }) {
  const [texto, setTexto] = useState(value || '');
  useEffect(() => setTexto(value || ''), [value]);

  const alCambiar = (t) => {
    setTexto(t);
    if (t === '') onChange('');
    else if (/^\d{4}-\d{2}-\d{2}$/.test(t) && dayjs(t, FORMATO, true).isValid()) onChange(t);
  };

  return (
    <TextInput
      style={styles.texto}
      value={texto}
      onChangeText={alCambiar}
      placeholder="AAAA-MM-DD"
      placeholderTextColor={colors.textoClaro}
      keyboardType="numbers-and-punctuation"
      maxLength={10}
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  texto: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.tinta,
    backgroundColor: colors.fondoInput,
    borderWidth: 1,
    borderColor: colors.linea,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
});