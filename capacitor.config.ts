import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.id906e1cd915bd4afd9ebddf66f5e82b43',
  appName: 'earning-streak',
  webDir: 'dist',
  // No server.url — the app loads the bundled web build from dist/ so it works
  // as a real installed native app (no redirect to Chrome / the Lovable preview).
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#F97316',
      sound: 'chime.wav',
    },
  },
};

export default config;
