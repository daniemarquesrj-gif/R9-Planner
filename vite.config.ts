import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.BUILD_ID || `${Date.now()}`;
const buildTime = new Date().toISOString();

function versionGeneratorPlugin(): Plugin {
  return {
    name: 'vite-plugin-version-generator',
    buildStart() {
      try {
        const publicDir = path.resolve(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        const versionData = {
          version: buildId,
          buildTime: buildTime,
        };
        fs.writeFileSync(path.resolve(publicDir, 'version.json'), JSON.stringify(versionData, null, 2));
      } catch (err) {
        console.warn('Could not write public/version.json:', err);
      }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(
          {
            version: buildId,
            buildTime: buildTime,
          },
          null,
          2
        ),
      });
    },
    transformIndexHtml(html) {
      const metaTag = `\n    <meta name="app-build-id" content="${buildId}" />\n    <meta name="app-build-time" content="${buildTime}" />`;
      return html.replace('</head>', `${metaTag}\n  </head>`);
    },
  };
}

export default defineConfig(() => {
  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __APP_BUILD_TIME__: JSON.stringify(buildTime),
    },
    plugins: [versionGeneratorPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
    },
  };
});

