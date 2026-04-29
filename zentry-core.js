// ============================================================
//  zentry-core.js  —  Zentry App
//  Compatível com GitHub Pages e qualquer servidor estático
// ============================================================

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
                           from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, onSnapshot,
         collection, addDoc, query, where,
         orderBy, limit, getDocs, serverTimestamp }
                           from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── CONFIG ──
const firebaseConfig = {
  apiKey:            "AIzaSyB4U7iIO3OVrrwyWPPI057jTqZWF6V1osU",
  authDomain:        "zentry-app-74275.firebaseapp.com",
  projectId:         "zentry-app-74275",
  storageBucket:     "zentry-app-74275.appspot.com",
  messagingSenderId: "571422826071",
  appId:             "1:571422826071:web:ba1ca6fea76e360bb80d12"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── ZENTRYAUTH ──
export const ZentryAuth = {

  // Protege tela — redireciona se não logado
  // Uso: ZentryAuth.exigirLogin().then(user => { ... })
  exigirLogin() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        if (user) resolve(user);
        else window.location.href = "login.html";
      });
    });
  },

  // Telas públicas — redireciona se JÁ logado
  redirecionarSeLogado() {
    onAuthStateChanged(auth, (user) => {
      if (user) window.location.href = "home.html";
    });
  },

  logout() {
    return signOut(auth).then(() => {
      window.location.href = "login.html";
    });
  },

  atual() {
    return auth.currentUser;
  }
};

// ── ZENTRYUSER ──
export const ZentryUser = {

  // Escuta dados em tempo real
  escutar(uid, callback) {
    return onSnapshot(doc(db, "usuarios", uid), (snap) => {
      if (snap.exists()) callback(snap.data());
    });
  },

  // Busca uma vez
  buscar(uid) {
    return getDoc(doc(db, "usuarios", uid)).then((snap) => {
      return snap.exists() ? snap.data() : null;
    });
  },

  buscarPorCPF(cpf) {
    const q = query(collection(db, "usuarios"), where("cpf", "==", cpf), limit(1));
    return getDocs(q).then((snap) => {
      if (snap.empty) return null;
      return { uid: snap.docs[0].id, ...snap.docs[0].data() };
    });
  },

  buscarPorChavePix(chave) {
    const q = query(collection(db, "chaves_pix"), where("chave", "==", chave), limit(1));
    return getDocs(q).then((snap) => {
      if (snap.empty) return null;
      return snap.docs[0].data();
    });
  }
};

// ── ZENTRYPIX ──
export const ZentryPix = {

  criarCobranca(uid, valor, descricao = "") {
    if (valor <= 0) return Promise.reject(new Error("Valor inválido"));
    return addDoc(collection(db, "cobrancas"), {
      criadorId: uid,
      valor,
      descricao,
      status:    "pendente",
      criadoEm: serverTimestamp()
    }).then((ref) => ref.id);
  },

  minhasCobrancas(uid, quantidade = 20) {
    const q = query(
      collection(db, "cobrancas"),
      where("criadorId", "==", uid),
      orderBy("criadoEm", "desc"),
      limit(quantidade)
    );
    return getDocs(q).then((snap) =>
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
    );
  }
};

// ── ZENTRATRANSACOES ──
export const ZentryTransacoes = {

  buscar(uid, quantidade = 30) {
    const q = query(
      collection(db, "usuarios", uid, "transacoes"),
      orderBy("criadoEm", "desc"),
      limit(quantidade)
    );
    return getDocs(q).then((snap) =>
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
    );
  },

  escutar(uid, callback, quantidade = 30) {
    const q = query(
      collection(db, "usuarios", uid, "transacoes"),
      orderBy("criadoEm", "desc"),
      limit(quantidade)
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }
};

// ── ZENTRYUI ──
export const ZentryUI = {

  formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL"
    });
  },

  saudacao() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return "Bom dia,";
    if (h >= 12 && h < 18) return "Boa tarde,";
    return "Boa noite,";
  },

  formatarData(timestamp) {
    if (!timestamp) return "—";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString("pt-BR") + " às " +
           d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  },

  toast(mensagem, tipo = "info") {
    const cores = { sucesso:"#22c55e", erro:"#ef4444", info:"#3b82f6", aviso:"#f59e0b" };
    // Remove toast anterior se existir
    const anterior = document.getElementById("zentry-toast");
    if (anterior) anterior.remove();

    const el = document.createElement("div");
    el.id = "zentry-toast";
    el.innerText = mensagem;
    Object.assign(el.style, {
      position:   "fixed",
      bottom:     "100px",
      left:       "50%",
      transform:  "translateX(-50%)",
      background: cores[tipo] || cores.info,
      color:      "#fff",
      padding:    "12px 24px",
      borderRadius: "14px",
      fontWeight: "600",
      fontSize:   "14px",
      zIndex:     "9999",
      boxShadow:  "0 4px 20px rgba(0,0,0,0.4)",
      whiteSpace: "nowrap",
      transition: "opacity 0.3s"
    });
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 300);
    }, 2700);
  },

  loading(ativo) {
    const id = "zentry-loading";
    if (ativo) {
      if (document.getElementById(id)) return;

      // Adiciona keyframes uma vez
      if (!document.getElementById("zentry-styles")) {
        const style = document.createElement("style");
        style.id = "zentry-styles";
        style.textContent = `
          @keyframes zSpin {
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }

      const el = document.createElement("div");
      el.id = id;
      el.innerHTML = `
        <div style="
          width:44px; height:44px;
          border:4px solid rgba(255,255,255,0.1);
          border-top:4px solid #22c55e;
          border-radius:50%;
          animation:zSpin 0.8s linear infinite;
        "></div>`;
      Object.assign(el.style, {
        position:       "fixed",
        inset:          "0",
        background:     "rgba(0,0,0,0.65)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        zIndex:         "99999"
      });
      document.body.appendChild(el);
    } else {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  }
};
  // --- AUTO-INSTALADOR ZENTRY (PWA) ---
(function() {
    // Injeta o manifest.json no <head> de qualquer página que use o core
    if (!document.querySelector('link[rel="manifest"]')) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = './manifest.json';
        document.head.appendChild(link);
    }

    // Registra o Service Worker para habilitar o modo "Instalar Aplicativo"
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log('Zentry: Sistema de App Ativo'))
                .catch(err => console.log('Zentry: Erro no App Mode', err));
        });
    }
})();
  
