import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Documento HTML raíz. Solo se ejecuta en el build/servidor (nunca en el cliente).
 * Aquí viven las etiquetas que hacen que el navegador reconozca la app como PWA.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es-MX">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

       
        <meta
          name="description"
          content="Administra tus ingresos, gastos y presupuesto mensual con Mi Bolsillo, incluso sin conexión."
        />

        {/* PWA: manifest + color de la barra del navegador */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3F6D73" />

        {/* Íconos (rutas reales en /public/icons) */}
        <link rel="icon" type="image/png" sizes="48x48" href="/icons/favicon-48.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        {/* iOS: modo app a pantalla completa */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Mi Bolsillo" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        <ScrollViewStyleReset />

        {/* Fondo desde el primer pixel: evita el destello blanco antes de que cargue el CSS/JS */}
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body{background-color:#F6F8FA;}body{overscroll-behavior-y:none;}`,
          }}
        />
      </head>

      <body>
        {children}
        <noscript>Mi Bolsillo necesita JavaScript para funcionar.</noscript>
      </body>
    </html>
  );
}