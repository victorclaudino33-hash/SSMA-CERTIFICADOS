# 🚀 SSMA CONTROL PLATFORM v5.0

> Motor de geração e compilação de certificados em escala com precisão milimétrica, ajuste vetorial dinâmico e sincronização em nuvem em tempo real.

O **SSMA CONTROL PLATFORM** é um ecossistema completo para operadores de Segurança do Trabalho, Meio Ambiente e Saúde Ocupacional (SSMA). O sistema automatiza o fluxo exaustivo de emitir certificados individuais a partir de listas do Excel, renderizando arquivos PDF finais com posicionamento customizável por curso de forma rápida, segura e moderna.

🌍 **Acesse a plataforma em produção:** [https://ssma-certificados.vercel.app/](https://ssma-certificados.vercel.app/)

---

## 💎 Demonstração Visual e Design (Neon UI)
A interface foi projetada utilizando conceitos modernos de design cyberpunk/dark futurista, apelidada de **Neon UI**, trazendo:
* Paleta de cores escuras profundas (`#070b12`) com acentuações vibrantes em vermelho, verde e azul.
* Efeito de textura de ruído analógico integrado nativamente no background via SVG embutido.
* Tipografia futurista de alto impacto utilizando as fontes *Syne* e *Space Mono*.
* Responsividade completa com layouts estruturados, transições e feedbacks visuais via Toasts customizados.

---

## ✨ Principais Funcionalidades

### 🔐 1. Sistema de Autenticação e Níveis de Acesso
* Integrado nativamente ao **Firebase Authentication**.
* Separação dinâmica de papéis: Usuários comuns contra administradores de sistema.
* **Painel Administrativo (Gestão de Operadores):** Área restrita para exclusão, listagem em tempo real (`onSnapshot`) e provisionamento de novos operadores, além de importação e exportação em lote (`.json`) de configurações do sistema.

### 📊 2. Processamento Inteligente de Planilhas (Excel)
* Upload e parsing imediato de arquivos `.xlsx` / `.csv` do lado do cliente utilizando a biblioteca `XLSX (SheetJS)`.
* Contagem e validação automatizada de registros com feedback interativo de carregamento.

### 📐 3. Ajuste Vetorial e Posicionamento Dinâmico
* Suporte a templates customizados carregando imagens de **Frente** e **Verso** do certificado.
* Painel de sliders interativos para ajuste preciso de eixos verticais ($Y$) e tamanho de fonte ($S$) para o Nome, Curso e Data.
* Ajustes salvos de forma dedicada por tipo de treinamento corporativo (Ex: `NR10`, `NR10 SEP`, `NR20`, `NR06`, `NR35`, `NR33`, `SGA`, `DIREÇÃO`).

### 🖨️ 4. Compilação Master em Lote (PDF)
* Geração assíncrona de arquivos PDF combinando imagens base e textos dinâmicos via `jsPDF` e `PDF.js`.
* Barra de progresso e contadores em tempo real para acompanhar compilações massivas de dezenas ou centenas de alunos simultaneamente sem travar a interface do navegador.

---

## 🛠️ Tecnologias Utilizadas

A arquitetura do projeto foi desenhada para rodar de forma leve diretamente no client-side, consumindo microsserviços em nuvem:

* **Front-end:** HTML5 semântico, CSS3 Custom Variables (Variáveis CSS nativas) e animações `@keyframes`.
* **Lógica de Negócios:** JavaScript Vanilla (ES6+) assíncrono conduzido por eventos.
* **Banco de Dados & Auth:** Firebase App/Auth/Firestore v9 (Compat Layer) operando com sincronização reativa.
* **Manipulação de Arquivos:** * [SheetJS (XLSX)](https://sheetjs.com/) - Parsing de dados do Excel.
    * [jsPDF](https://github.com/parallax/jsPDF) - Geração de documentos PDF vetoriais.
    * [PDF.js](https://mozilla
