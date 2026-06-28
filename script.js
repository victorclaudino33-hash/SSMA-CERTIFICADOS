/* ══════════════════════════════════════════════════════════════════════
   SSMA CONTROL PLATFORM — script.js  v5.0
   Firebase Auth (e-mail/senha) + Firestore integrado.
   FIRESTORE COLLECTIONS:
   operadores/   → { uid, email, displayName, role, createdAt }
   configuracoes/ → doc "sliders" com posições por curso
   ═════════════════════════════════════════════════════════════════

/* ── PDF.js & jsPDF ─────────────────────────────────────────────────── */
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}
const { jsPDF } = window.jspdf;

/* ══════════════════════════════════════════════════════════════════════
   FIREBASE CONFIG
   ══════════════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCCSztIKT0GBtY1tZ7atVeaq624s4NFPvs",
    authDomain: "certificados-ssma.firebaseapp.com",
    projectId: "certificados-ssma",
    storageBucket: "certificados-ssma.firebasestorage.app",
    messagingSenderId: "909959630836",
    appId: "1:909959630836:web:f1f064abc288ef886333a1"
};

/* ── Estado do Firebase ─────────────────────────────────────────────── */
let firebaseReady = false;
let auth = null;
let db   = null;

function initFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        auth = firebase.auth();
        db   = firebase.firestore();
        firebaseReady = true;
        updateConnectionStatus(true);
    } catch (err) {
        console.warn('Firebase não iniciado. Modo demo ativo.', err);
        firebaseReady = false;
        updateConnectionStatus(false);
    }
}

function updateConnectionStatus(online) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;
    if (online) {
        el.className = 'conn-status conn-online';
        el.innerHTML = '<span class="conn-dot"></span><span class="conn-text">FIREBASE ONLINE</span>';
    } else {
        el.className = 'conn-status conn-offline';
        el.innerHTML = '<span class="conn-dot"></span><span class="conn-text">MODO DEMO</span>';
    }
}

/* ══════════════════════════════════════════════════════════════════════
   ESTADO GLOBAL
   ══════════════════════════════════════════════════════════════════════ */
let contaLogada  = null;
let dadosExcel   = [];
let imgFrente    = null;
let imgVerso     = null;
let modoPreview  = 'frente';

const slotsCursos    = ['NR10', 'NR10 SEP', 'NR20', 'NR06', 'NR35', 'NR33', 'SGA', 'DIRECAO'];
let slotAtivo        = slotsCursos[0];
const sliderDefaults = { yn: 105, sn: 26, yc: 125, sc: 14, yd: 145, sd: 12 };

/* ══════════════════════════════════════════════════════════════════════
   UI HELPERS
   ══════════════════════════════════════════════════════════════════════ */
function setVal(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value !== undefined ? (el.value = text) : (el.innerText = text);
}

function showToast(msg, tipo = 'info') {
    const old = document.getElementById('ssma-toast');
    if (old) old.remove();
    const colors = { ok: 'var(--green)', erro: 'var(--red)', info: 'var(--blue)' };
    const cor = colors[tipo] || colors.info;
    
    const toast = document.createElement('div');
    toast.id = 'ssma-toast';
    toast.style.cssText = [
        'position:fixed;bottom:24px;right:24px;z-index:9999',
        'background:var(--s2);border:1px solid ' + cor,
        'color:var(--t1);padding:12px 18px;border-radius:10px',
        'font-family:var(--font-mono);font-size:11px;letter-spacing:.8px',
        'box-shadow:0 8px 32px rgba(0,0,0,.5)',
        'animation:toastIn .2s ease',
        'display:flex;align-items:center;gap:10px;max-width:340px'
    ].join(';');
    
    const dot = '<span style="width:7px;height:7px;border-radius:50%;background:' + cor + ';display:inline-block;flex-shrink:0"></span>';
    toast.innerHTML = dot + msg;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastOut .3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function setBtnLoading(id, loading, label = 'Aguarde...') {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn._origHTML = btn.innerHTML;
        btn.innerHTML = '<span style="opacity:.6">' + label + '</span>';
    } else if (btn._origHTML) {
        btn.innerHTML = btn._origHTML;
    }
}

function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
}

function hideError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

/* ══════════════════════════════════════════════════════════════════════
   LOGIN UI
   ══════════════════════════════════════════════════════════════════════ */
function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('tabLogin').classList.toggle('active', isLogin);
    document.getElementById('tabRegister').classList.toggle('active', !isLogin);
    document.getElementById('formLogin').classList.toggle('hidden', !isLogin);
    document.getElementById('formRegister').classList.toggle('hidden', isLogin);
    const indicator = document.getElementById('tabIndicator');
    if (indicator) indicator.classList.toggle('right', !isLogin);
    
    hideError('loginError');
    hideError('regError');
}

function togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.style.opacity = '1';
    } else {
        input.type = 'password';
        btn.style.opacity = '0.4';
    }
}

/* ══════════════════════════════════════════════════════════════════════
   AUTENTICAÇÃO — FIREBASE
   ══════════════════════════════════════════════════════════════════════ */
async function fazerLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPass').value;
    hideError('loginError');
    
    if (!email || !pass) {
        showError('loginError', 'Preencha e-mail e senha.');
        return;
    }
    if (!firebaseReady) {
        showError('loginError', 'Firebase não configurado. Adicione suas credenciais no script.js');
        return;
    }
    
    setBtnLoading('btnLogin', true, 'Autenticando...');
    try {
        const cred = await auth.signInWithEmailAndPassword(email, pass);
        await onLoginSuccess(cred.user);
    } catch (err) {
        const msgs = {
            'auth/user-not-found':   'Usuário não encontrado.',
            'auth/wrong-password':   'Senha incorreta.',
            'auth/invalid-email':    'E-mail inválido.',
            'auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos.',
        };
        showError('loginError', msgs[err.code] || 'Erro de autenticação: ' + err.message);
        setBtnLoading('btnLogin', false);
    }
}

async function fazerRegistro() {
    const name  = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass  = document.getElementById('regPass').value;
    hideError('regError');
    
    if (!name || !email || !pass) {
        showError('regError', 'Preencha todos os campos.');
        return;
    }
    if (pass.length < 6) {
        showError('regError', 'Senha deve ter mínimo 6 caracteres.');
        return;
    }
    if (!firebaseReady) {
        showError('regError', 'Firebase não configurado. Adicione suas credenciais no script.js');
        return;
    }
    
    setBtnLoading('btnRegister', true, 'Criando conta...');
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await cred.user.updateProfile({ displayName: name });
        
        await db.collection('operadores').doc(cred.user.uid).set({
            uid:         cred.user.uid,
            email:       email,
            displayName: name,
            role:        'user',
            createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Conta criada com sucesso!', 'ok');
        await onLoginSuccess(cred.user);
    } catch (err) {
        const msgs = {
            'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
            'auth/invalid-email':        'E-mail inválido.',
            'auth/weak-password':        'Senha muito fraca.',
        };
        showError('regError', msgs[err.code] || err.message);
        setBtnLoading('btnRegister', false);
    }
}

async function onLoginSuccess(firebaseUser) {
    let perfil = { role: 'user', displayName: firebaseUser.displayName || firebaseUser.email };
    try {
        const doc = await db.collection('operadores').doc(firebaseUser.uid).get();
        if (doc.exists) perfil = { ...perfil, ...doc.data() };
    } catch (e) { /* Firestore offline */ }
    
    contaLogada = {
        uid:         firebaseUser.uid,
        email:       firebaseUser.email,
        displayName: perfil.displayName || firebaseUser.displayName || 'Operador',
        role:        perfil.role
    };
    
    entrarInterface();
    showToast('Acesso autorizado — ' + contaLogada.displayName, 'ok');
}

function entrarInterface() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('mainInterface').classList.remove('hidden');
    
    const name    = contaLogada.displayName || contaLogada.email || 'OP';
    const initial = name.charAt(0).toUpperCase();
    document.getElementById('userAvatar').textContent   = initial;
    document.getElementById('userBadgeText').textContent = name;
    
    if (contaLogada.role === 'admin') {
        document.getElementById('adminBtn').classList.remove('hidden');
        carregarListaEquipe();
        escutarOperadores();
    }
    
    inicializarSlots();
    Promise.all([
        carregarConfigSliders(slotAtivo),
        aplicarModeloCertificadoAtivo(slotAtivo)
    ]).then(() => ajusteReal());
}

function fazerLogout() {
    if (firebaseReady && auth) {
        auth.signOut().catch(() => {});
    }
    location.reload();
}

/* ══════════════════════════════════════════════════════════════════════
   GESTÃO DE OPERADORES (ADMIN)
   ══════════════════════════════════════════════════════════════════════ */
async function carregarListaEquipe() {
    if (!firebaseReady || !db) return;
    try {
        const snap = await db.collection('operadores').get();
        renderizarEquipe(snap.docs.map(d => d.data()));
    } catch (err) {
        showToast('Falha ao carregar operadores.', 'erro');
    }
}

function escutarOperadores() {
    if (!firebaseReady || !db) return;
    db.collection('operadores').onSnapshot(snap => {
        renderizarEquipe(snap.docs.map(d => d.data()));
    }, err => console.warn('onSnapshot falhou:', err));
}

function renderizarEquipe(lista) {
    const el = document.getElementById('listaEquipe');
    if (!el) return;
    if (!lista || lista.length === 0) {
        el.innerHTML = '<span style="font-size:11px;color:var(--t3)">Nenhum operador cadastrado</span>';
        return;
    }
    el.innerHTML = lista.map(c => 
        '<div class="team-card">' +
        '<span>' + (c.displayName || c.email || c.user || '—') + '</span>' +
        '<span class="team-card-role">' + (c.role || 'user') + '</span>' +
        (c.role !== 'admin' && c.uid !== (contaLogada && contaLogada.uid) ? 
         '<button class="team-card-remove" onclick="removerColaborador(\'' + c.uid + '\', \'' + (c.displayName || '') + '\')">×</button>'
         : '') +
        '</div>'
    ).join('');
}

async function adicionarColaborador() {
    const name  = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const pass  = document.getElementById('newUserPass').value;
    if (!name || !email || !pass) return showToast('Preencha nome, e-mail e senha.', 'erro');
    if (!firebaseReady) return showToast('Firebase necessário para adicionar operadores.', 'erro');
    
    try {
        const id = 'pending_' + Date.now();
        await db.collection('operadores').doc(id).set({
            uid: id, email, displayName: name, role: 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            pending: true
        });
        document.getElementById('newUserName').value = '';
        document.getElementById('newUserEmail').value = '';
        document.getElementById('newUserPass').value = '';
        showToast('Operador "' + name + '" adicionado. Solicite que crie a conta com este e-mail.', 'ok');
    } catch (err) {
        showToast('Erro ao adicionar: ' + err.message, 'erro');
    }
}

async function removerColaborador(uid, name) {
    if (!confirm('Remover operador "' + name + '"?')) return;
    try {
        await db.collection('operadores').doc(uid).delete();
        showToast('Operador removido.', 'ok');
    } catch (err) {
        showToast('Erro ao remover: ' + err.message, 'erro');
    }
}

function toggleAdminPanel() {
    document.getElementById('adminPanel').classList.toggle('hidden');
}

async function exportarDadosSistema() {
    try {
        let payload = { sliders: {}, operadores: [] };
        if (firebaseReady && db) {
            const cfgDoc = await db.collection('configuracoes').doc('sliders').get();
            if (cfgDoc.exists) payload.sliders = cfgDoc.data();
        } else {
            payload.sliders = JSON.parse(localStorage.getItem('ssma_sliders') || '{}');
        }
        const a = document.createElement('a');
        a.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2)));
        a.setAttribute('download', 'ssma_config_backup.json');
        a.click();
        showToast('Config exportada!', 'ok');
    } catch (err) {
        showToast('Erro ao exportar.', 'erro');
    }
}

async function importarDadosSistema(input) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.sliders) {
                if (firebaseReady && db) {
                    await db.collection('configuracoes').doc('sliders').set(data.sliders, { merge: true });
                } else {
                    localStorage.setItem('ssma_sliders', JSON.stringify(data.sliders));
                }
                showToast('Layout importado!', 'ok');
            } else {
                showToast('Arquivo JSON sem dados de sliders.', 'erro');
            }
        } catch (err) {
            showToast('Arquivo JSON inválido!', 'erro');
        }
    };
    reader.readAsText(input.files[0]);
}

/* ══════════════════════════════════════════════════════════════════════
   CONFIGURAÇÕES DE SLIDERS (por curso)
   ══════════════════════════════════════════════════════════════════════ */
async function salvarConfigSliders(curso) {
    const config = {
        yn: document.getElementById('range_y_nome').value,
        sn: document.getElementById('range_s_nome').value,
        yc: document.getElementById('range_y_cpf').value,
        sc: document.getElementById('range_s_cpf').value,
        yd: document.getElementById('range_y_data').value,
        sd: document.getElementById('range_s_data').value,
        updatedAt: new Date().toISOString()
    };
    if (firebaseReady && db) {
        try {
            const obj = {};
            obj[curso] = config;
            await db.collection('configuracoes').doc('sliders').set(obj, { merge: true });
        } catch (err) {
            salvarLocalStorage(curso, config);
        }
    } else {
        salvarLocalStorage(curso, config);
    }
}

function salvarLocalStorage(curso, config) {
    const local = JSON.parse(localStorage.getItem('ssma_sliders') || '{}');
    local[curso] = config;
    localStorage.setItem('ssma_sliders', JSON.stringify(local));
}

async function carregarConfigSliders(curso) {
    if (firebaseReady && db) {
        try {
            const snap = await db.collection('configuracoes').doc('sliders').get();
            if (snap.exists && snap.data()[curso]) {
                aplicarConfigSliders(snap.data()[curso]);
                return;
            }
        } catch (err) { /* fallback */ }
    }
    const local = JSON.parse(localStorage.getItem('ssma_sliders') || '{}');
    if (local[curso]) { aplicarConfigSliders(local[curso]); return; }
    
    aplicarConfigSliders(sliderDefaults);
}

function aplicarConfigSliders(cfg) {
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    s('range_y_nome', cfg.yn ?? sliderDefaults.yn);
    s('range_s_nome', cfg.sn ?? sliderDefaults.sn);
    s('range_y_cpf',  cfg.yc ?? sliderDefaults.yc);
    s('range_s_cpf',  cfg.sc ?? sliderDefaults.sc);
    s('range_y_data', cfg.yd ?? sliderDefaults.yd);
    s('range_s_data', cfg.sd ?? sliderDefaults.sd);
}

async function salvarConfig() {
    await salvarConfigSliders(slotAtivo);
    showToast('Config do ' + slotAtivo + ' salva' + (firebaseReady ? ' na nuvem!' : ' localmente!'), 'ok');
}

/* ══════════════════════════════════════════════════════════════════════
   SLOTS / CURSOS
   ══════════════════════════════════════════════════════════════════════ */
function inicializarSlots() {
    const container = document.getElementById('slotContainer');
    if (!container) return;
    container.innerHTML = slotsCursos.map(s =>
        '<button class="cbtn ' + (s === slotAtivo ? 'active' : '') + '" ' +
        'onclick="selecionarSlot(\'' + s + '\', this)" ' +
        'role="radio" aria-checked="' + (s === slotAtivo) + '" type="button">' +
        s + '</button>'
    ).join('');
    document.getElementById('topbarCourse').textContent = slotAtivo;
}

async function selecionarSlot(s, btn) {
    await salvarConfigSliders(slotAtivo);
    slotAtivo = s;
    document.querySelectorAll('.cbtn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-checked', 'true');
    document.getElementById('topbarCourse').textContent = s;
    await carregarConfigSliders(slotAtivo);
    await aplicarModeloCertificadoAtivo(slotAtivo);
    ajusteReal();
    showToast('Módulo ' + s + ' carregado', 'info');
}

/* ══════════════════════════════════════════════════════════════════════
   MODO PREVIEW
   ══════════════════════════════════════════════════════════════════════ */
function mudarModoPreview(modo) {
    modoPreview = modo;
    const bf = document.getElementById('btnPrevFrente');
    const bv = document.getElementById('btnPrevVerso');
    if (bf && bv) {
        bf.classList.toggle('lens-btn-active', modo === 'frente');
        bv.classList.toggle('lens-btn-active', modo === 'verso');
    }
    ajusteReal();
}

/* ══════════════════════════════════════════════════════════════════════
   PDF
   ══════════════════════════════════════════════════════════════════════ */
function processarPDF(input, tipo) {
    if (!input.files || !input.files[0]) return;
    const reader   = new FileReader();
    const statusEl = document.getElementById(tipo === 'frente' ? 'statusFrente' : 'statusVerso');
    const dotEl    = document.getElementById(tipo === 'frente' ? 'dotFrente'    : 'dotVerso');
    if (statusEl) statusEl.innerText = 'PROCESSANDO...';
    showToast('Lendo PDF de ' + tipo + '...', 'info');
    
    reader.onload = function(e) {
        pdfjsLib.getDocument(new Uint8Array(e.target.result)).promise.then(pdf => {
            pdf.getPage(1).then(page => {
                const viewport = page.getViewport({ scale: 2.0 });
                const cvs      = document.createElement('canvas');
                const ctx      = cvs.getContext('2d');
                cvs.height     = viewport.height;
                cvs.width      = viewport.width;
                page.render({ canvasContext: ctx, viewport }).promise.then(() => {
                    // JPEG comprimido pesa 80-90% menos que PNG, deixando o site
                    // mais leve e rápido (importação, troca de módulo e geração em lote)
                    const dataURL = cvs.toDataURL('image/jpeg', 0.85);
                    if (tipo === 'frente') imgFrente = dataURL;
                    else                   imgVerso  = dataURL;
                    salvarModeloPDF(slotAtivo, tipo, dataURL);
                    if (statusEl) statusEl.innerText = 'ONLINE';
                    if (dotEl)    dotEl.classList.add('loaded');
                    ajusteReal();
                    showToast('PDF de ' + tipo + ' salvo no modelo ' + slotAtivo + '!', 'ok');
                });
            });
        }).catch(() => {
            if (statusEl) statusEl.innerText = 'ERRO AO LER PDF';
            showToast('Falha ao processar PDF.', 'erro');
        });
    };
    reader.readAsArrayBuffer(input.files[0]);
}

/* ══════════════════════════════════════════════════════════════════════
   CANVAS — PREVIEW
   ══════════════════════════════════════════════════════════════════════ */
function ajusteReal() {
    const canvas   = document.getElementById('previewCanvas');
    const emptyMsg = document.getElementById('canvasEmptyMsg');
    if (!canvas) return;
    const ctx   = canvas.getContext('2d');
    const bgImg = modoPreview === 'frente' ? imgFrente : imgVerso;
    
    if (!bgImg) {
        canvas.width = 1188; canvas.height = 840;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return; 
    }
    
    if (emptyMsg) emptyMsg.classList.add('hidden');
    
    const img = new Image();
    img.src = bgImg;
    img.onload = function() {
        canvas.width  = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        if (modoPreview === 'frente') {
            const ratio = img.height / 210;
            const hRat  = img.height / 600;
            const yn = +document.getElementById('range_y_nome').value * ratio;
            const sn = +document.getElementById('range_s_nome').value * hRat;
            const yc = +document.getElementById('range_y_cpf').value  * ratio;
            const sc = +document.getElementById('range_s_cpf').value  * hRat;
            const yd = +document.getElementById('range_y_data').value * ratio;
            const sd  = +document.getElementById('range_s_data').value * hRat;
            
            setVal('txt_y_nome', document.getElementById('range_y_nome').value + 'mm');
            setVal('txt_s_nome', document.getElementById('range_s_nome').value + 'pt');
            setVal('txt_y_cpf',  document.getElementById('range_y_cpf').value  + 'mm');
            setVal('txt_s_cpf',  document.getElementById('range_s_cpf').value  + 'pt');
            setVal('txt_y_data', document.getElementById('range_y_data').value + 'mm');
            setVal('txt_s_data', document.getElementById('range_s_data').value + 'pt');
            
            let nomeSample = 'NOME DO COLABORADOR COMPLETO';
            let cpfSample  = '000.000.000-00';
            let dataSample = '22/05/2026';
            
            if (dadosExcel.length  > 0) {
                nomeSample = buscarNaPlanilha(dadosExcel[0], 'nome') || nomeSample;
                cpfSample  = buscarNaPlanilha(dadosExcel[0], 'cpf')  || cpfSample;
                dataSample = dadosExcel[0][slotAtivo] || buscarNaPlanilha(dadosExcel[0], 'data') || dataSample;
            }
            
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.font      = 'bold ' + sn + 'px sans-serif';
            ctx.fillText(String(nomeSample).toUpperCase(), canvas.width / 2, yn);
            ctx.font = sc + 'px sans-serif';
            ctx.fillText('CPF: ' + cpfSample, canvas.width / 2, yc);
            ctx.font = sd + 'px sans-serif';
            ctx.fillText('Data: ' + formatarData(dataSample), canvas.width / 2, yd);
            
            if (dadosExcel.length  > 0) {
                document.getElementById('psbName').innerText    = String(nomeSample).toUpperCase();
                document.getElementById('psbDetails').innerText = 'Matriz: ' + slotAtivo + ' // CPF: ' + cpfSample;
            }
        }
    };
}

/* ══════════════════════════════════════════════════════════════════════
   GERAÇÃO DE LOTE MASTER
   ══════════════════════════════════════════════════════════════════════ */
async function gerarLoteCompleto() {
    if (dadosExcel.length === 0) return showToast('Vincule uma planilha Excel antes!', 'erro');
    if (!imgFrente || !imgVerso)  return showToast('Carregue FRENTE e VERSO em PDF antes!', 'erro');
    const barFill = document.getElementById('progressBarFill');
    const pctMsg  = document.getElementById('progressMsg');
    
    if (pctMsg) pctMsg.innerText = '0%';
    if (barFill) barFill.style.width = '0%';
    
    await salvarConfigSliders(slotAtivo);
    
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const yn  = parseFloat(document.getElementById('range_y_nome').value);
    const sn  = parseFloat(document.getElementById('range_s_nome').value);
    const yc  = parseFloat(document.getElementById('range_y_cpf').value);
    const sc  = parseFloat(document.getElementById('range_s_cpf').value);
    const yd  = parseFloat(document.getElementById('range_y_data').value);
    const sd  = parseFloat(document.getElementById('range_s_data').value);
    
    for (let i = 0; i < dadosExcel.length; i++) {
        if (i > 0) doc.addPage();
        doc.addImage(imgFrente, formatoImagem(imgFrente), 0, 0, 297, 210);
        doc.setTextColor(0, 0, 0);
        
        const p    = dadosExcel[i];
        const nome = buscarNaPlanilha(p, 'nome');
        const cpf  = buscarNaPlanilha(p, 'cpf');
        const data = p[slotAtivo] || buscarNaPlanilha(p, 'data');
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(sn);
        doc.text(String(nome).toUpperCase(), 148.5, yn, { align: 'center' });
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(sc);
        doc.text('CPF: ' + cpf, 148.5, yc, { align: 'center' });
        doc.setFontSize(sd);
        doc.text('Data: ' + formatarData(data), 148.5, yd, { align: 'center' });
        
        doc.addPage();
        doc.addImage(imgVerso, formatoImagem(imgVerso), 0, 0, 297, 210);
        
        const pct = Math.round(((i + 1) / dadosExcel.length) * 100);
        if (pctMsg) pctMsg.innerText = pct + '%';
        if (barFill) barFill.style.width = pct + '%';
        await new Promise(r => setTimeout(r, 5));
    }
    
    doc.save('LOTE_MASTER_SSMA_' + slotAtivo.replace(/\s+/g, '_') + '.pdf');
    if (pctMsg) pctMsg.innerText = 'COMPILADO ✓';
    showToast('Lote de ' + dadosExcel.length + ' certificados gerado!', 'ok');
}

/* ══════════════════════════════════════════════════════════════════════
   HELPERS DE DADOS
   ══════════════════════════════════════════════════════════════════════ */
function buscarNaPlanilha(obj, termo) {
    const chave = Object.keys(obj).find(k => k.toLowerCase().includes(termo.toLowerCase()));
    return chave ? obj[chave] : '';
}

function formatoImagem(dataURL) {
    return (dataURL && dataURL.indexOf('image/png') !== -1) ? 'PNG' : 'JPEG';
}

function formatarData(val) {
    if (!val) return '';
    if (typeof val === 'number') {
        // 25569 é o offset entre a época do Excel (1900) e a época Unix (1970).
        const utcDays = Math.floor(val - 25569);
        
        // Cria a data baseada nos dias UTC e formata especificamente para o fuso UTC,
        // garantindo que o número do dia não seja alterado pelo fuso local (GMT-3).
        const date = new Date(Date.UTC(1970, 0, 1 + utcDays));
        return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
    return String(val);
}

/* ══════════════════════════════════════════════════════════════════════
   DOM READY
   ══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    
    document.getElementById('loginPass')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') fazerLogin();
    });
    document.getElementById('loginEmail')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('loginPass')?.focus();
    });
    document.getElementById('regPass')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') fazerRegistro();
    });
    
    const exInput = document.getElementById('excelInput');
    if (exInput) {
        exInput.addEventListener('change', (e) => {
            if (!e.target.files || !e.target.files[0]) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                const wb    = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                dadosExcel  = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                document.getElementById('contagemAlunos').innerText = dadosExcel.length + ' REGISTROS';
                document.getElementById('psbDetails').innerText     = dadosExcel.length + ' registros prontos. Primeiro: ' +
                    (buscarNaPlanilha(dadosExcel[0], 'nome') || '—');
                ajusteReal();
                showToast(dadosExcel.length + ' registros carregados!', 'ok');
            };
            reader.readAsArrayBuffer(e.target.files[0]);
        });
    }
});

/* ══════════════════════════════════════════════════════════════════════
   AUTO-SALVAR CAMPOS DO CERTIFICADO (NOVO — não altera nada acima)
   A cada ajuste de slider (posição Y / tamanho de fonte de Nome, CPF ou
   Data), a configuração é salva automaticamente para o certificado/módulo
   ativo (slotAtivo), sem precisar clicar manualmente em "Salvar Configuração".
   Usa debounce de 800ms: só salva quando o usuário pausa de arrastar,
   evitando gravar a cada pixel movido.
   ══════════════════════════════════════════════════════════════════════ */
let _autoSaveCertificadoTimer = null;
function autoSalvarCamposCertificado() {
    clearTimeout(_autoSaveCertificadoTimer);
    _autoSaveCertificadoTimer = setTimeout(async () => {
        await salvarConfigSliders(slotAtivo);
        showToast('Campos do ' + slotAtivo + ' salvos automaticamente', 'ok');
    }, 800);
}

document.addEventListener('DOMContentLoaded', () => {
    const idsCamposCertificado = [
        'range_y_nome', 'range_s_nome',
        'range_y_cpf',  'range_s_cpf',
        'range_y_data', 'range_s_data'
    ];
    idsCamposCertificado.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', autoSalvarCamposCertificado);
    });
});

/* ══════════════════════════════════════════════════════════════════════
   MODELOS DE CERTIFICADO — PDF FRENTE/VERSO POR MÓDULO (NOVO)
   Cada módulo (NR10, NR10 SEP, NR20, NR06, NR35, NR33, SGA, DIRECAO)
   agora guarda o SEU PRÓPRIO PDF de frente/verso, salvo automaticamente
   no momento do upload — exatamente igual já acontece com os sliders.
   Ao trocar de módulo, o respectivo modelo é recarregado sozinho na tela.
   Tenta salvar na nuvem (Firestore) e cai para localStorage se preciso
   (mesmo padrão usado em salvarConfigSliders / carregarConfigSliders).
   ══════════════════════════════════════════════════════════════════════ */
let modelosPorCertificado = {}; // cache em memória: { NR10: { frente, verso } }

// Chave própria por certificado+lado (ex: ssma_modelo_NR10_frente).
// Assim, salvar um modelo novo NÃO precisa reler/reescrever os outros já salvos —
// é isso que deixa a importação de PDF e a troca de módulo mais rápida e leve.
function chaveModeloLocal(curso, tipo) {
    return 'ssma_modelo_' + curso.replace(/\s+/g, '_') + '_' + tipo;
}

function salvarModeloPDFLocal(curso, tipo, dataURL) {
    try {
        localStorage.setItem(chaveModeloLocal(curso, tipo), dataURL);
    } catch (err) {
        console.warn('Não foi possível salvar o modelo localmente (PDF muito grande para o navegador).', err);
        showToast('Modelo salvo só nesta sessão (arquivo grande demais para o navegador).', 'erro');
    }
}

function carregarModeloPDFLocal(curso, tipo) {
    try {
        const direto = localStorage.getItem(chaveModeloLocal(curso, tipo));
        if (direto) return direto;
    } catch (err) { /* segue para formato antigo abaixo */ }
    // Compatibilidade com a versão anterior, que salvava tudo num único JSON
    // (chave "ssma_modelos"). Se achar algo lá, continua funcionando normalmente.
    try {
        const antigo = JSON.parse(localStorage.getItem('ssma_modelos') || '{}');
        if (antigo[curso] && antigo[curso][tipo]) return antigo[curso][tipo];
    } catch (err) { /* nada salvo */ }
    return null;
}

async function salvarModeloPDF(curso, tipo, dataURL) {
    modelosPorCertificado[curso] = modelosPorCertificado[curso] || {};
    modelosPorCertificado[curso][tipo] = dataURL;

    if (firebaseReady && db) {
        try {
            const patch = {};
            patch[tipo] = dataURL;
            patch.updatedAt = new Date().toISOString();
            await db.collection('modelosCertificados').doc(curso).set(patch, { merge: true });
            return;
        } catch (err) {
            console.warn('Falha ao salvar modelo na nuvem, usando localStorage.', err);
        }
    }
    salvarModeloPDFLocal(curso, tipo, dataURL);
}

async function carregarModeloPDF(curso) {
    if (modelosPorCertificado[curso]) return modelosPorCertificado[curso];

    if (firebaseReady && db) {
        try {
            const snap = await db.collection('modelosCertificados').doc(curso).get();
            if (snap.exists) {
                modelosPorCertificado[curso] = snap.data();
                return modelosPorCertificado[curso];
            }
        } catch (err) { /* cai para localStorage abaixo */ }
    }

    const frente = carregarModeloPDFLocal(curso, 'frente');
    const verso  = carregarModeloPDFLocal(curso, 'verso');
    if (frente || verso) {
        modelosPorCertificado[curso] = { frente, verso };
        return modelosPorCertificado[curso];
    }
    return null;
}

async function aplicarModeloCertificadoAtivo(curso) {
    const modelo = await carregarModeloPDF(curso);
    imgFrente = (modelo && modelo.frente) || null;
    imgVerso  = (modelo && modelo.verso)  || null;

    const statusFrente = document.getElementById('statusFrente');
    const statusVerso  = document.getElementById('statusVerso');
    const dotFrente     = document.getElementById('dotFrente');
    const dotVerso      = document.getElementById('dotVerso');

    if (statusFrente) statusFrente.innerText = imgFrente ? 'ONLINE' : 'AGUARDANDO PDF';
    if (statusVerso)  statusVerso.innerText  = imgVerso  ? 'ONLINE' : 'AGUARDANDO PDF';
    if (dotFrente) dotFrente.classList.toggle('loaded', !!imgFrente);
    if (dotVerso)  dotVerso.classList.toggle('loaded', !!imgVerso);
}

/* ══════════════════════════════════════════════════════════════════════
   GUIA "COMO USAR" (NOVO — não altera nada existente)
   Cria um botão no topo da plataforma que abre um modal com o passo a
   passo de uso, para quem está acessando o sistema por primeira vez.
   Tudo é montado em runtime via JS, sem precisar editar o HTML/CSS.
   ══════════════════════════════════════════════════════════════════════ */
function criarBotaoAjuda() {
    if (document.getElementById('btnAjuda')) return; // evita duplicar se já existir
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;

    const btn = document.createElement('button');
    btn.id = 'btnAjuda';
    btn.className = 'tb-btn';
    btn.type = 'button';
    btn.innerHTML = '<i class="ri-question-line"></i> Como Usar';
    btn.onclick = abrirModalAjuda;

    const sairBtn = topbarRight.querySelector('.tb-btn-red');
    if (sairBtn) topbarRight.insertBefore(btn, sairBtn);
    else topbarRight.appendChild(btn);
}

function abrirModalAjuda() {
    if (document.getElementById('ssma-help-overlay')) return; // já está aberto

    const passos = [
        { titulo: '1. Entrar',
          texto: 'Acesse com seu e-mail e senha de operador. Ainda não tem conta? Use a aba "Criar Conta" na tela de login.' },
        { titulo: '2. Escolher o módulo',
          texto: 'Na barra lateral, em "Módulos de Treinamento", clique no certificado que vai trabalhar (NR10, NR20, Direção, etc).' },
        { titulo: '3. Carregar o modelo em PDF',
          texto: 'Em "Vetores de Background", suba o PDF de Frente e o de Verso. Isso é salvo automaticamente para aquele módulo — só precisa fazer uma vez.' },
        { titulo: '4. Ajustar a posição dos campos',
          texto: 'Em "Engenharia de Eixos", use os controles deslizantes para posicionar Nome, CPF e Data no lugar certo. Os ajustes salvam sozinhos.' },
        { titulo: '5. Vincular a planilha',
          texto: 'Clique em "Vincular Dataset .XLSX" e selecione a planilha com os dados dos alunos (nome, CPF, data). Veja a estrutura exigida e baixe um modelo logo abaixo ⬇' },
        { titulo: '6. Gerar o lote',
          texto: 'Clique em "EXECUTAR COMPILAÇÃO MASTER EM LOTE" para gerar um único PDF com todos os certificados, frente e verso, prontos para imprimir.' },
        { titulo: '7. Administração (se você for admin)',
          texto: 'No botão "Operadores", você pode adicionar/remover colaboradores e exportar/importar as configurações da equipe.' }
    ];

    const overlay = document.createElement('div');
    overlay.id = 'ssma-help-overlay';
    overlay.style.cssText = [
        'position:fixed', 'inset:0', 'background:rgba(0,0,0,.65)',
        'backdrop-filter:blur(4px)', 'z-index:10000',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:24px', 'animation:toastIn .2s ease'
    ].join(';');
    overlay.onclick = (e) => { if (e.target === overlay) fecharModalAjuda(); };

    const card = document.createElement('div');
    card.style.cssText = [
        'background:var(--s2,#16181d)', 'border:1px solid var(--b2,#2a2d35)',
        'border-radius:16px', 'max-width:560px', 'width:100%', 'max-height:84vh',
        'overflow-y:auto', 'padding:28px', 'box-shadow:0 24px 64px rgba(0,0,0,.5)',
        'font-family:var(--font-mono, monospace)', 'color:var(--t1,#fff)'
    ].join(';');

    let html = '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;gap:12px;">';
    html += '<div><h2 style="margin:0 0 4px;font-family:var(--font-display, sans-serif);font-size:20px;">Como Usar a Plataforma</h2>';
    html += '<p style="margin:0;font-size:12px;color:var(--t3,#888);">Passo a passo para gerar certificados em lote</p></div>';
    html += '<button id="ssma-help-close" type="button" style="background:transparent;border:none;color:var(--t2,#ccc);font-size:22px;cursor:pointer;line-height:1;padding:4px;flex-shrink:0;">×</button></div>';

    passos.forEach(p => {
        html += '<div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--b1,#222);">';
        html += '<div style="font-weight:700;font-size:13px;margin-bottom:4px;color:var(--amber,#f5a623);">' + p.titulo + '</div>';
        html += '<div style="font-size:13px;line-height:1.5;color:var(--t2,#ccc);">' + p.texto + '</div>';
        html += '</div>';
    });

    // Bloco extra: estrutura exigida da planilha .xlsx (gerado a partir dos módulos reais do sistema)
    html += '<div style="margin-top:4px;padding:14px;border:1px solid var(--b2,#2a2d35);border-radius:10px;">';
    html += '<div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--blue-bright,#4da3ff);">📊 Estrutura da planilha (.xlsx)</div>';
    html += '<div style="font-size:12.5px;line-height:1.6;color:var(--t2,#ccc);margin-bottom:10px;">';
    html += 'Use <b>uma única planilha</b> para todos os alunos e todos os módulos. As colunas devem ser:<br>';
    html += '• <b>Nome</b> — nome completo do aluno<br>';
    html += '• <b>CPF</b> — CPF do aluno<br>';
    html += '• <b>Uma coluna para cada certificado</b>, com o nome EXATAMENTE igual ao módulo (' + slotsCursos.join(', ') + '). Preencha com a data do treinamento <b>só na coluna do certificado que o aluno concluiu</b> — deixe as outras colunas em branco.<br>';
    html += 'Ao gerar o lote, o sistema busca a data automaticamente na coluna do módulo selecionado naquele momento.';
    html += '</div>';

    html += '<div style="overflow-x:auto;margin-bottom:12px;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    html += '<tr style="background:var(--s1,#0d0f13);">';
    ['Nome', 'CPF', slotsCursos[0], slotsCursos[2] || slotsCursos[1] || slotsCursos[0]].forEach(col => {
        html += '<th style="border:1px solid var(--b2,#2a2d35);padding:6px;text-align:left;color:var(--t1,#fff);">' + col + '</th>';
    });
    html += '</tr>';
    html += '<tr>' +
        '<td style="border:1px solid var(--b2,#2a2d35);padding:6px;">João da Silva</td>' +
        '<td style="border:1px solid var(--b2,#2a2d35);padding:6px;">000.000.000-00</td>' +
        '<td style="border:1px solid var(--b2,#2a2d35);padding:6px;">22/05/2026</td>' +
        '<td style="border:1px solid var(--b2,#2a2d35);padding:6px;"></td>' +
        '</tr>';
    html += '<tr>' +
        '<td style="border:1px solid var(--b2,#2a2d35);padding:6px;">Maria Souza</td>' +
        '<td style="border:1px solid var(--b2,#2a2d35);padding:6px;">111.111.111-11</td>' +
        '<td style="border:1px solid var(--b2,#2a2d35);padding:6px;"></td>' +
        '<td style="border:1px solid var(--b2,#2a2d35);padding:6px;">22/05/2026</td>' +
        '</tr>';
    html += '</table></div>';

    html += '<button id="ssma-help-download-template" type="button" style="background:var(--blue-bright,#4da3ff);border:none;color:#0a0a0a;font-weight:700;font-size:12px;padding:8px 14px;border-radius:8px;cursor:pointer;">📥 Baixar planilha modelo (.xlsx)</button>';
    html += '</div>';

    card.innerHTML = html;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    document.getElementById('ssma-help-close').onclick = fecharModalAjuda;
    const btnDownloadTemplate = document.getElementById('ssma-help-download-template');
    if (btnDownloadTemplate) btnDownloadTemplate.onclick = baixarPlanilhaModelo;
    document.addEventListener('keydown', fecharModalAjudaEsc);
}

function fecharModalAjudaEsc(e) {
    if (e.key === 'Escape') fecharModalAjuda();
}

function fecharModalAjuda() {
    const overlay = document.getElementById('ssma-help-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', fecharModalAjudaEsc);
}

// Gera uma planilha .xlsx modelo com Nome, CPF e uma coluna pra cada
// módulo cadastrado (slotsCursos), já com exemplos de preenchimento.
function baixarPlanilhaModelo() {
    if (typeof XLSX === 'undefined') {
        showToast('Biblioteca de planilha (XLSX) não carregada.', 'erro');
        return;
    }
    const linhaVazia = { Nome: '', CPF: '' };
    slotsCursos.forEach(c => { linhaVazia[c] = ''; });

    const exemplo1 = Object.assign({}, linhaVazia, { Nome: 'João da Silva', CPF: '000.000.000-00' });
    exemplo1[slotsCursos[0]] = '22/05/2026';

    const exemplo2 = Object.assign({}, linhaVazia, { Nome: 'Maria Souza', CPF: '111.111.111-11' });
    exemplo2[slotsCursos[2] || slotsCursos[0]] = '22/05/2026';

    const ws = XLSX.utils.json_to_sheet([exemplo1, exemplo2]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
    XLSX.writeFile(wb, 'planilha_modelo_ssma.xlsx');
    showToast('Planilha modelo baixada!', 'ok');
}

document.addEventListener('DOMContentLoaded', criarBotaoAjuda);
