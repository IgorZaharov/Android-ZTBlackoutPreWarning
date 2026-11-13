import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function readAndroidBuildVersion(): string {
  try {
    const gradleContent = fs.readFileSync(path.resolve(process.cwd(), 'android/app/build.gradle.kts'), 'utf-8');
    const match = gradleContent.match(/versionName\s*=.*?"([0-9]+\.[0-9]+\.[0-9]+)"/);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // Fallback
  }
  return '1.4.0';
}

export default defineConfig(() => {
  const appVersion = readAndroidBuildVersion();
  const port = 3000;
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/proxy-ztoe-poweron': {
          target: 'https://api-ztoe-poweron.inneti.net',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/proxy-ztoe-poweron/, '')
        },
        '/proxy-ztoe': {
          target: 'https://www.ztoe.com.ua',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/proxy-ztoe/, '')
        }
      }
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
