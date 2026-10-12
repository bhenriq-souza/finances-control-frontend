// Configuração de runtime (spec 0003). Copie para public/config.js para rodar localmente:
//   cp public/config.example.js public/config.js
// A web config do Firebase não é segredo. Em dev e prd este arquivo vem do ConfigMap (spec 0007).
window.__FTECH_CONFIG__ = {
    environment: 'dev', // 'local' | 'dev' | 'prd'
    firebase: {
        apiKey: '__SET_IN_PUBLIC_CONFIG_JS__',
        authDomain: 'dev-financial-control.firebaseapp.com',
        projectId: 'dev-financial-control',
        appId: '1:805955182517:web:652d21a187283fa505c3fc',
    },
};
