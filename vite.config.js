import {defineConfig} from 'vite';
export default defineConfig({server:{host:'127.0.0.1',port:5189,strictPort:true,proxy:{'/api':'http://127.0.0.1:5188'}},build:{target:'es2022',chunkSizeWarningLimit:850,rollupOptions:{output:{manualChunks:{three:['three'],icons:['lucide']}}}}});
