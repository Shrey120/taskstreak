import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.id906e1cd915bd4afd9ebddf66f5e82b43',
  appName: 'earning-streak',
  webDir: 'dist',
  // No server.url — the app loads the bundled web build from dist/ so it works
  // as a real installed native app (no redirect to Chrome / the Lovable preview).
  plugins: {
    LocalNotifications: {
      // Real resources now: res/drawable/ic_stat_taskstreak.xml and
      // res/raw/chime.wav. The previous names were scaffolding placeholders
      // that never existed, so Android silently fell back to defaults.
      smallIcon: 'ic_stat_taskstreak',
      iconColor: '#F97316',
      sound: 'chime.wav',
    },
  },
};

export default config;
