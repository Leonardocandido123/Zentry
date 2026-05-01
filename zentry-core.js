// ============================================================
//  zentry-core.js  —  Zentry App (VERSÃO CORRIGIDA)
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
  exigirLogin() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        if (user) resolve(user);
        else window.location.href = "login.html";
      });
    });
  },
  redirecionarSeLogado() {
    onAuthStateChanged(auth, (user) => {
      if (user) window.location.href = "home.html";
    });
  },
  logout() {
    localStorage.clear();
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
  async obterIdPorEmail() {
    const email = localStorage.getItem("usuarioEmail");
    if (!email) return null;
    try {
        const q = query(collection(db, "usuarios"), where("email", "==", email), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].id; 
    } catch (e) {
        console.error("Erro ao buscar UID:", e);
        return null;
    }
  },

  escutar(uid, callback) {
    return onSnapshot(doc(db, "usuarios", uid), (snap) => {
      if (snap.exists()) callback(snap.data());
    });
  },

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

// ── ZENTRYTRANSACOES ──
export const ZentryTransacoes = {
  escutar(uid, callback, quantidade = 30) {
    const q = query(
      collection(db, "usuarios", uid, "transacoes"),
      orderBy("timestamp", "desc"),
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

  // ✅ FUNÇÃO ADICIONADA — usada pelo comprovante.html
  formatarData(timestamp) {
    try {
      // Suporta Firestore Timestamp e Date nativo
      const date = timestamp && timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const data = date.toLocaleDateString("pt-BR");
      const hora = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return `${data} às ${hora}`;
    } catch (e) {
      return "Data indisponível";
    }
  },

  saudacao() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return "Bom dia,";
    if (h >= 12 && h < 18) return "Boa tarde,";
    return "Boa noite,";
  }
};

// --- AUTO-INSTALADOR ZENTRY (PWA) ---
(function() {
    if (!document.querySelector('link[rel="manifest"]')) {
        const link = document.createElement('link');
        link.rel = 'manifest'; link.href = './manifest.json';
        document.head.appendChild(link);
    }
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
        });
    }
})();
