
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es-MX">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#F8F6F2" />
        <meta
          name="description"
          content="Administra tus ingresos, gastos y presupuesto mensual con MI BOLSILLO."
        />

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/assets/images/favicon.png" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />

        <ScrollViewStyleReset />
      </head>

      <body>{children}</body>
    </html>
  );
}
