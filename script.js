pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
const { jsPDF } = window.jspdf;

// --- SISTEMA DE ACESSOS ---
let dbEquipe = JSON.parse(localStorage.getItem('ability_v8_users')) || [{ user: "Admin", pass: "2729", role: "admin" }];

function validarLogin() {
    const u = document.getElementById('userInput').value, p = document.getElementById('passInput').value;
    const conta = dbEquipe.find(c => c.user === u && c.pass === p);
    if (conta) {
        document.getElementById('loginSection').classList.add('hidden-section');
        document.getElementById('mainInterface').classList.remove('hidden-section');
        document.getElementById('userBadge').innerText = `OP: ${conta.user.toUpperCase()}`;
        if(conta.role === 'admin') {
            document.getElementById('adminBtn').classList.remove('hidden-section');
            renderizarEquipe();
        }
        inicializarSlots();
    } else { alert("Usuário ou Senha incorretos!"); }
}

function renderizarEquipe() {
    document.getElementById('listaEquipe').innerHTML = dbEquipe.map((c, i) => `
        <div class="bg-white/5 p-4 rounded-2xl border border-white/10 relative group">
            <p class="text-[10px] font-black text-white uppercase">${c.user}</p>
            <p class="text-[9px] text-red-500 font-mono mt-1">${c.pass}</p>
            ${c.user !== 'Admin' ? `<button onclick="removerColaborador(${i})" class="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition font-bold">REMOVER</button>` : ''}
        </div>`).join('');
}

function adicionarColaborador() {
    const n = document.getElementById('newUserName').value, s = document.getElementById('newUserPass').value;
    if(n && s) {
        dbEquipe.push({user:n, pass:s, role:"user"});
        localStorage.setItem('ability_v8_users', JSON.stringify(dbEquipe));
        renderizarEquipe();
    }
}

function removerColaborador(i) {
    dbEquipe.splice(i, 1);
    localStorage.setItem('ability_v8_users', JSON.stringify(dbEquipe));
    renderizarEquipe();
}

function toggleAdminPanel() { document.getElementById('adminPanel').classList.toggle('hidden-section'); }

// --- MOTOR DE DADOS ---
const listaCursos = ["NR10", "NR10 SEP", "NR06", "NR20", "NR35", "SGA", "DIRECAO", "OUTROS"];
let slotAtivo = "NR10";
let imgFrente = null, imgVerso = null, dadosExcel = [];

function inicializarSlots() {
    document.getElementById('slotContainer').innerHTML = listaCursos.map(n => 
        `<button onclick="trocarSlot('${n}')" id="slot_${n.replace(/\s/g, '')}" class="slot-btn">${n}</button>`
    ).join('');
    trocarSlot('NR10');
}

function trocarSlot(nome) {
    slotAtivo = nome;
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('slot-active'));
    const btn = document.getElementById('slot_'+nome.replace(/\s/g, ''));
    if(btn) btn.classList.add('slot-active');
    
    const salvo = JSON.parse(localStorage.getItem('ability_v8_model_' + slotAtivo));
    if(salvo) {
        document.getElementById('range_y_nome').value = salvo.yn; document.getElementById('range_s_nome').value = salvo.sn;
        document.getElementById('range_y_cpf').value = salvo.yc; document.getElementById('range_s_cpf').value = salvo.sc;
        document.getElementById('range_y_data').value = salvo.yd; document.getElementById('range_s_data').value = salvo.sd;
        imgFrente = salvo.frente || null;
        imgVerso = salvo.verso || null;
    } else {
        imgFrente = null; imgVerso = null;
    }
    atualizarLabels();
    updatePreview();
}

function ajusteReal() {
    atualizarLabels();
    updatePreview();
    salvarSlot();
}

function salvarSlot() {
    const modelo = {
        yn: document.getElementById('range_y_nome').value, sn: document.getElementById('range_s_nome').value,
        yc: document.getElementById('range_y_cpf').value, sc: document.getElementById('range_s_cpf').value,
        yd: document.getElementById('range_y_data').value, sd: document.getElementById('range_s_data').value,
        frente: imgFrente, verso: imgVerso
    };
    localStorage.setItem('ability_v8_model_' + slotAtivo, JSON.stringify(modelo));
}

function atualizarLabels() {
    const ids = ['nome', 'cpf', 'data'];
    ids.forEach(id => {
        document.getElementById(`txt_y_${id}`).innerText = document.getElementById(`range_y_${id}`).value + 'mm';
        document.getElementById(`txt_s_${id}`).innerText = document.getElementById(`range_s_${id}`).value + 'pt';
    });
    document.getElementById('statusFrente').innerText = imgFrente ? "PDF FRENTE: SALVO" : "PDF FRENTE: VAZIO";
    document.getElementById('statusFrente').style.color = imgFrente ? "#22c55e" : "#64748b";
    document.getElementById('statusVerso').innerText = imgVerso ? "PDF VERSO: SALVO" : "PDF VERSO: VAZIO";
    document.getElementById('statusVerso').style.color = imgVerso ? "#22c55e" : "#64748b";
}

function buscarNaPlanilha(aluno, termo) {
    const chaves = Object.keys(aluno);
    const encontrada = chaves.find(c => c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(termo.toLowerCase()));
    return encontrada ? aluno[encontrada] : "";
}

async function processarPDF(input, tipo) {
    const file = input.files[0];
    if(!file) return;
    const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvasTmp = document.createElement('canvas');
    canvasTmp.width = viewport.width; canvasTmp.height = viewport.height;
    await page.render({ canvasContext: canvasTmp.getContext('2d'), viewport }).promise;
    
    if(tipo === 'frente') imgFrente = canvasTmp.toDataURL('image/png');
    else imgVerso = canvasTmp.toDataURL('image/png');
    
    salvarSlot();
    ajusteReal();
}

function updatePreview() {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    if (!imgFrente) {
        canvas.classList.add('hidden-section');
        document.getElementById('placeholder').classList.remove('hidden-section');
        return;
    }
    const img = new Image();
    img.onload = () => {
        canvas.width = 2970; canvas.height = 2100;
        canvas.classList.remove('hidden-section');
        document.getElementById('placeholder').classList.add('hidden-section');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const ratio = 10;
        ctx.fillStyle = "black"; ctx.textAlign = "center";
        const aluno = dadosExcel[0] || {};
        
        const nome = buscarNaPlanilha(aluno, 'nome') || "NOME DO ALUNO";
        const cpf = buscarNaPlanilha(aluno, 'cpf') || "000.000.000-00";
        const dataRaw = aluno[slotAtivo] || buscarNaPlanilha(aluno, 'data') || "20/03/2026";

        ctx.font = `bold ${document.getElementById('range_s_nome').value * 3.5}px sans-serif`;
        ctx.fillText(nome.toUpperCase(), canvas.width/2, document.getElementById('range_y_nome').value * ratio);
        
        ctx.font = `${document.getElementById('range_s_cpf').value * 3.5}px sans-serif`;
        ctx.fillText(`CPF: ${cpf}`, canvas.width/2, document.getElementById('range_y_cpf').value * ratio);
        
        ctx.font = `${document.getElementById('range_s_data').value * 3.5}px sans-serif`;
        ctx.fillText(`Data: ${formatarData(dataRaw)}`, canvas.width/2, document.getElementById('range_y_data').value * ratio);
    };
    img.src = imgFrente;
}

document.getElementById('excelInput').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const wb = XLSX.read(new Uint8Array(ev.target.result), {type: 'array', cellDates: true});
        dadosExcel = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        updatePreview();
        alert(dadosExcel.length + " Alunos carregados!");
    };
    reader.readAsArrayBuffer(e.target.files[0]);
};

function formatarData(v) {
    if (!v) return "";
    if (v instanceof Date) return v.toLocaleDateString('pt-BR');
    if (typeof v === 'number') return new Date((v - 25569) * 86400 * 1000).toLocaleDateString('pt-BR');
    return v.toString();
}

async function gerarLoteCompleto() {
    if(!imgFrente || !imgVerso || dadosExcel.length === 0) return alert("Erro: Verifique se os PDFs e a Planilha foram carregados.");
    document.getElementById('statusMsg').classList.remove('hidden-section');
    
    setTimeout(() => {
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const config = {
            yn: document.getElementById('range_y_nome').value, sn: document.getElementById('range_s_nome').value,
            yc: document.getElementById('range_y_cpf').value, sc: document.getElementById('range_s_cpf').value,
            yd: document.getElementById('range_y_data').value, sd: document.getElementById('range_s_data').value
        };

        dadosExcel.forEach((p, i) => {
            if(i > 0) doc.addPage();
            doc.addImage(imgFrente, 'PNG', 0, 0, 297, 210);
            doc.setTextColor(0,0,0);
            
            const nome = buscarNaPlanilha(p, 'nome');
            const cpf = buscarNaPlanilha(p, 'cpf');
            const data = p[slotAtivo] || buscarNaPlanilha(p, 'data');

            doc.setFontSize(config.sn); doc.text(nome.toUpperCase(), 148.5, config.yn, {align: "center"});
            doc.setFontSize(config.sc); doc.text(`CPF: ${cpf}`, 148.5, config.yc, {align: "center"});
            doc.setFontSize(config.sd); doc.text(`Data: ${formatarData(data)}`, 148.5, config.yd, {align: "center"});
            
            doc.addPage();
            doc.addImage(imgVerso, 'PNG', 0, 0, 297, 210);
        });
        doc.save(`Ability_${slotAtivo}_Lote.pdf`);
        document.getElementById('statusMsg').classList.add('hidden-section');
    }, 500);
}