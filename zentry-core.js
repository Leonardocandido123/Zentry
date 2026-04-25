// ============================================================
//  zentry-core.js  —  Zentry App
//  Arquivo central: importar em TODAS as telas assim:
//
//  <script type="module">
//    import { auth, db, ZentryAuth, ZentryUser, ZentryPix,
//             ZentryTransacoes, ZentryUI } from './zentry-core.js';
//  </script>
// ============================================================

import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
                                from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, onSnapshot,
         collection, addDoc, query, where,
         orderBy, limit, getDocs, serverTimestamp }
                                from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────
//  CONFIG FIREBASE (único lugar para alterar)
// ─────────────────────────────────────────────────────────────
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


// ─────────────────────────────────────────────────────────────
//  ZENTRYAUTH  —  Controle de sessão e proteção de telas
// ─────────────────────────────────────────────────────────────
export const ZentryAuth = {

  /**
   * Use em TODAS as telas protegidas (home, extrato, pix, etc.)
   * Redireciona para login.html se não houver sessão.
   * Retorna o usuário se estiver logado.
   *
   * Exemplo de uso:
   *   const user = await ZentryAuth.exigirLogin();
   */
  exigirLogin() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          resolve(user);
        } else {
          window.location.href = "login.html";
        }
      });
    });
  },

  /**
   * Use nas telas públicas (login, cadastro, splash).
   * Se o usuário JÁ estiver logado, redireciona para home.html.
   */
  redirecionarSeLogado() {
    onAuthStateChanged(auth, (user) => {
      if (user) window.location.href = "home.html";
    });
  },

  /**
   * Logout com redirecionamento para login.html
   */
  async logout() {
    await signOut(auth);
    window.location.href = "login.html";
  },

  /** Retorna o usuário atual (ou null) */
  atual() {
    return auth.currentUser;
  }
};


// ─────────────────────────────────────────────────────────────
//  ZENTRYUSER  —  Dados do usuário no Firestore
// ─────────────────────────────────────────────────────────────
export const ZentryUser = {

  /**
   * Escuta dados do usuário em tempo real (nome, saldo, etc.)
   * Chame 1x por tela que precise exibir saldo ou nome.
   *
   * Exemplo:
   *   ZentryUser.escutar(user.uid, (dados) => {
   *     document.getElementById('saldo').innerText = ZentryUI.formatarMoeda(dados.saldo);
   *     document.getElementById('nome').innerText = dados.nome;
   *   });
   */
  escutar(uid, callback) {
    return onSnapshot(doc(db, "usuarios", uid), (snap) => {
      if (snap.exists()) callback(snap.data());
    });
  },

  /**
   * Busca dados do usuário uma única vez (sem tempo real).
   */
  async buscar(uid) {
    const snap = await getDoc(doc(db, "usuarios", uid));
    return snap.exists() ? snap.data() : null;
  },

  /**
   * Busca usuário pelo CPF (para transferências)
   */
  async buscarPorCPF(cpf) {
    const q = query(collection(db, "usuarios"), where("cpf", "==", cpf), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { uid: snap.docs[0].id, ...snap.docs[0].data() };
  },

  /**
   * Busca usuário pela chave Pix
   */
  async buscarPorChavePix(chave) {
    const q = query(collection(db, "chaves_pix"), where("chave", "==", chave), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data();
  }
};


// ─────────────────────────────────────────────────────────────
//  ZENTRYPIX  —  Operações Pix
// ─────────────────────────────────────────────────────────────
export const ZentryPix = {

  /**
   * Cria uma cobrança Pix (QR Code / Copia e Cola)
   * O pagamento em si deve ser processado via Cloud Function.
   *
   * Exemplo:
   *   const cobranca = await ZentryPix.criarCobranca(user.uid, 150.00, "Serviço X");
   */
  async criarCobranca(uid, valor, descricao = "") {
    if (valor <= 0) throw new Error("Valor inválido");
    const ref = await addDoc(collection(db, "cobrancas"), {
      criadorId:  uid,
      valor:      valor,
      descricao:  descricao,
      status:     "pendente",   // pendente | pago | cancelado
      criadoEm:   serverTimestamp()
    });
    return ref.id; // ID da cobrança (usar para gerar QR Code)
  },

  /**
   * Busca cobranças criadas pelo usuário
   */
  async minhasCobrancas(uid, quantidade = 20) {
    const q = query(
      collection(db, "cobrancas"),
      where("criadorId", "==", uid),
      orderBy("criadoEm", "desc"),
      limit(quantidade)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};


// ─────────────────────────────────────────────────────────────
//  ZENTRATRANSACOES  —  Histórico financeiro
// ─────────────────────────────────────────────────────────────
export const ZentryTransacoes = {

  /**
   * Busca as últimas transações do usuário
   *
   * Exemplo:
   *   const transacoes = await ZentryTransacoes.buscar(user.uid, 30);
   */
  async buscar(uid, quantidade = 30) {
    const q = query(
      collection(db, "usuarios", uid, "transacoes"),
      orderBy("criadoEm", "desc"),
      limit(quantidade)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /**
   * Escuta transações em tempo real (útil no extrato)
   */
  escutar(uid, callback, quantidade = 30) {
    const q = query(
      collection(db, "usuarios", uid, "transacoes"),
      orderBy("criadoEm", "desc"),
      limit(quantidade)
    );
    return onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(lista);
    });
  }
};


// ─────────────────────────────────────────────────────────────
//  ZENTRYUI  —  Funções de interface reutilizáveis
// ─────────────────────────────────────────────────────────────
export const ZentryUI = {

  /**
   * Formata número como moeda brasileira
   *   ZentryUI.formatarMoeda(1500) → "R$ 1.500,00"
   */
  formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL"
    });
  },

  /**
   * Retorna saudação conforme horário
   *   ZentryUI.saudacao() → "Bom dia," / "Boa tarde," / "Boa noite,"
   */
  saudacao() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return "Bom dia,";
    if (h >= 12 && h < 18) return "Boa tarde,";
    return "Boa noite,";
  },

  /**
   * Formata data do Firestore (Timestamp) para string legível
   *   ZentryUI.formatarData(transacao.criadoEm) → "25/04/2026 às 14:32"
   */
  formatarData(timestamp) {
    if (!timestamp) return "—";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString("pt-BR") + " às " +
           d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  },

  /**
   * Exibe um toast (mensagem flutuante) na tela
   *   ZentryUI.toast("Pix enviado com sucesso!", "sucesso");
   *   ZentryUI.toast("Saldo insuficiente", "erro");
   */
  toast(mensagem, tipo = "info") {
    const cores = { sucesso: "#22c55e", erro: "#ef4444", info: "#3b82f6", aviso: "#f59e0b" };
    const el = document.createElement("div");
    el.innerText = mensagem;
    Object.assign(el.style, {
      position: "fixed", bottom: "90px", left: "50%",
      transform: "translateX(-50%)",
      background: cores[tipo] || cores.info,
      color: "#fff", padding: "12px 20px",
      borderRadius: "12px", fontWeight: "600",
      fontSize: "14px", zIndex: "9999",
      boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
      animation: "fadeInUp 0.3s ease"
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  },

  /**
   * Mostra/esconde um loading spinner na tela
   *   ZentryUI.loading(true)   → exibe
   *   ZentryUI.loading(false)  → remove
   */
  loading(ativo) {
    const id = "zentry-loading";
    if (ativo) {
      if (document.getElementById(id)) return;
      const el = document.createElement("div");
      el.id = id;
      el.innerHTML = `<div style="
        width:40px;height:40px;border:4px solid rgba(255,255,255,0.1);
        border-top:4px solid #22c55e;border-radius:50%;
        animation:spin 0.8s linear infinite;
      "></div>`;
      Object.assign(el.style, {
        position: "fixed", inset: "0", background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: "99999"
      });
      // Adiciona keyframes se ainda não existirem
      if (!document.getElementById("zentry-styles")) {
        const style = document.createElement("style");
        style.id = "zentry-styles";
        style.textContent = `
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeInUp { from { opacity:0; transform:translateX(-50%) translateY(10px); }
                                to   { opacity:1; transform:translateX(-50%) translateY(0); } }
        `;
        document.head.appendChild(style);
      }
      document.body.appendChild(el);
    } else {
      document.getElementById(id)?.remove();
    }
  }
};
