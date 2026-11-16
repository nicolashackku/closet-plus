import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Rutas relativas: funciona igual en localhost y en GitHub Pages (usuario.github.io/repo/).
  base: './',
  plugins: [react()],
  // Puerto fijo: los datos del armario se guardan por dirección (localhost:5173).
  server: { port: 5173, strictPort: true, host: true },
  preview: { port: 5173, strictPort: true },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
})
