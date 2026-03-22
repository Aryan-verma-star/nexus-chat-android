import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexus.chathub',
  appName: 'Nexus Chat Hub',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    backgroundColor: '#ffffff',
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    cleartext: true,
    androidScheme: 'https'
  }
};

export default config;
