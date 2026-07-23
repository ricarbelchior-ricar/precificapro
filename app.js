// ==========================================
// CONFIGURAÇÕES GLOBAIS & ENDPOINTS
// ==========================================
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/YOUR_LINK_HERE';
const API_LEAD_ENDPOINT = 'https://hook.eu1.make.com/879uf44q5j9maf1egcdubpuxs2dnvn1w';
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

// Simulador DataLayer & Google Analytics
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', GA_MEASUREMENT_ID);

function trackEvent(eventName, params = {}) {
    gtag('event', eventName, params);
    console.log(`[Analytics Event]: ${eventName}`, params);
}

// ==========================================
// ESTADO DA APLICAÇÃO
// ==========================================
let lastCalc = null;
let isUnlocked = false;

// Gestão de Paywall & Validade (30 dias no localStorage)
const params = new URLSearchParams(window.location.search);
const now = new Date().getTime();
const savedExpiry = localStorage.getItem('precificapro_expires');

if (params.get('unlocked') === 'true') {
    localStorage.setItem('precificapro_unlocked', 'true');
    localStorage.setItem('precificapro_expires', (now + (30 * 24 * 60 * 60 * 1000)).toString());
}

if (localStorage.getItem('precificapro_unlocked') === 'true') {
    if (savedExpiry && now > parseInt(savedExpiry)) {
        localStorage.removeItem('precificapro_unlocked');
        localStorage.removeItem('precificapro_expires');
    } else {
        isUnlocked = true;
    }
}

// ==========================================
// INICIALIZAÇÃO DOS EVENTOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initUserId();
    setupEventListeners();
    parseUrlParameters();
    checkOnlineStatus();
    startFomoLoop();

    if (isUnlocked) {
        unlockPremiumUI();
    }
});

// Identificador único do utilizador
function initUserId() {
    if (!localStorage.getItem('precifica_uid')) {
        const uid = 'usr_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        localStorage.setItem('precifica_uid', uid);
    }
}
function getUserId() {
    return localStorage.getItem('precifica_uid') || 'usr_anonymous';
}

// Pré-preenchimento via URL / LocalStorage
function parseUrlParameters() {
    const fields = ['cost', 'shipping', 'fixedFee', 'fee', 'tax', 'cac', 'margin'];
    let hasValues = false;

    fields.forEach(field => {
        const paramVal = params.get(field);
        const inputEl = document.getElementById(field);
        if (inputEl) {
            if (paramVal !== null && !isNaN(paramVal) && paramVal !== '') {
                inputEl.value = sanitizeInput(paramVal);
                hasValues = true;
            } else {
                const savedVal = localStorage.getItem(`precifica_input_${field}`);
                if (savedVal) inputEl.value = savedVal;
            }
        }
    });

    if (hasValues || params.get('cost')) {
        const consent = document.getElementById('legal-consent');
        if (consent) consent.checked = true;
        toggleCalculateButton();
        executeCalculation();
    }
}

function sanitizeInput(val) {
    const parsed = parseFloat(val);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

// Listeners e Validação LGPD
function setupEventListeners() {
    const form = document.getElementById('calc-form');
    const consentCheckbox = document.getElementById('legal-consent');

    if (form) {
        form.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.id !== 'legal-consent') {
                localStorage.setItem(`precifica_input_${e.target.id}`, e.target.value);
            }
        });
    }

    if (consentCheckbox) {
        consentCheckbox.addEventListener('change', toggleCalculateButton);
    }
}

function toggleCalculateButton() {
    const consentCheckbox = document.getElementById('legal-consent');
    const btn = document.getElementById('btn-calculate');
    if (!btn) return;

    if (consentCheckbox && consentCheckbox.checked) {
        btn.disabled = false;
        btn.className = 'w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold py-3.5 px-6 rounded-xl shadow-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5';
    } else {
        btn.disabled = true;
        btn.className = 'w-full bg-slate-300 text-slate-500 font-bold py-3.5 px-6 rounded-xl shadow-lg transition duration-200 flex items-center justify-center gap-2 cursor-not-allowed';
    }
}

// ==========================================
// CÁLCULO MATEMÁTICO DE PRECIFICAÇÃO
// ==========================================
function executeCalculation() {
    const cost = sanitizeInput(document.getElementById('cost').value);
    const shipping = sanitizeInput(document.getElementById('shipping').value);
    const fixedFee = sanitizeInput(document.getElementById('fixedFee').value);
    const fee = sanitizeInput(document.getElementById('fee').value);
    const tax = sanitizeInput(document.getElementById('tax').value);
    const cac = sanitizeInput(document.getElementById('cac').value);
    const margin = sanitizeInput(document.getElementById('margin').value);

    const totalFixed = cost + shipping + fixedFee + cac;
    const feePerc = fee / 100;
    const taxPerc = tax / 100;
    const marginPerc = margin / 100;

    const denominator = 1 - (feePerc + taxPerc + marginPerc);
    if (denominator <= 0) {
        showToast('A soma das taxas e da margem não pode atingir ou ultrapassar 100%.', 'error');
        return;
    }

    const targetPrice = totalFixed / denominator;
    const profit = targetPrice * marginPerc;
    const breakEvenDenominator = 1 - (feePerc + taxPerc);
    const breakEven = breakEvenDenominator > 0 ? totalFixed / breakEvenDenominator : 0;

    lastCalc = {
        cost, shipping, fixedFee, fee, tax, cac, margin,
        feePerc, taxPerc, marginPerc,
        targetPrice, profit, breakEven
    };

    // Atualizar UI
    document.getElementById('res-target-price').textContent = formatBRL(targetPrice);
    document.getElementById('res-breakeven').textContent = formatBRL(breakEven);
    document.getElementById('res-net-profit').textContent = formatBRL(profit);
    document.getElementById('res-net-margin').textContent = `${margin.toFixed(1)}%`;

    updateStatusAlert(margin, profit);
    trackEvent('calculadora_resultado_exibido', { target_price: targetPrice.toFixed(2), margin });
}

function updateStatusAlert(margin, profit) {
    const box = document.getElementById('status-box');
    if (!box) return;

    if (profit <= 0 || margin <= 0) {
        box.className = 'p-4 rounded-xl border text-xs sm:text-sm font-semibold transition-all bg-rose-50 border-rose-200 text-rose-800';
        box.innerHTML = '⚠️ <strong>ALERTA DE PREJUÍZO:</strong> O preço calculado não cobre todas as taxas e custos operacionais.';
    } else if (margin < 8) {
        box.className = 'p-4 rounded-xl border text-xs sm:text-sm font-semibold transition-all bg-amber-50 border-amber-200 text-amber-800';
        box.innerHTML = '⚡ <strong>MARGEM APERTADA:</strong> Margem inferior a 8%. Qualquer devolução de produto pode gerar prejuízo.';
    } else {
        box.className = 'p-4 rounded-xl border text-xs sm:text-sm font-semibold transition-all bg-emerald-50 border-emerald-200 text-emerald-800';
        box.innerHTML = '✅ <strong>MARGEM SEGURA:</strong> Excelente estrutura de preço para garantir lucro líquido saudável.';
    }
}

// ==========================================
// COMPARTILHAMENTO & PROVA SOCIAL (FOMO)
// ==========================================
function copyShareUrl() {
    const fields = ['cost', 'shipping', 'fixedFee', 'fee', 'tax', 'cac', 'margin'];
    const query = fields.map(f => `${f}=${document.getElementById(f).value}`).join('&');
    const shareUrl = `${window.location.origin}${window.location.pathname}?utm_source=share&${query}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Link do resultado copiado com sucesso!');
    }).catch(() => {
        showToast('Erro ao copiar o link.', 'error');
    });
}

function startFomoLoop() {
    const messages = [
        "João de SP acabou de calcular a margem no Mercado Livre",
        "Maria de MG desbloqueou o Relatório PDF Profissional",
        "Carlos do PR otimizou as taxas de envio na Shopee",
        "Fernanda do RJ garantiu margem segura na Amazon"
    ];
    let idx = 0;
    setInterval(() => {
        if (isUnlocked) {
            const banner = document.getElementById('fomo-banner');
            if (banner) banner.classList.add('hidden');
            return;
        }
        idx = (idx + 1) % messages.length;
        const el = document.getElementById('fomo-text');
        if (el) {
            el.style.opacity = '0';
            setTimeout(() => {
                el.textContent = messages[idx];
                el.style.opacity = '1';
            }, 300);
        }
    }, 6000);
}

// ==========================================
// PAGAMENTO STRIPE & PAYWALL
// ==========================================
function startStripeCheckout() {
    if (!navigator.onLine) {
        showToast('Para finalizar a operação, verifique a sua conexão à internet.', 'warning');
        return;
    }
    trackEvent('calculadora_checkout_iniciado');
    const uid = getUserId();
    window.location.href = `${STRIPE_PAYMENT_LINK}?client_reference_id=${encodeURIComponent(uid)}`;
}

function unlockPremiumUI() {
    const overlay = document.getElementById('paywall-overlay');
    const blur = document.getElementById('paywall-blur');
    const btnDownload = document.getElementById('btn-download-pdf');
    const badge = document.getElementById('premium-badge');
    const banner = document.getElementById('fomo-banner');

    if (overlay) overlay.classList.add('hidden');
    if (blur) blur.classList.remove('blur-sm');
    if (btnDownload) btnDownload.classList.remove('hidden');
    if (badge) {
        badge.textContent = 'DESBLOQUEADO';
        badge.className = 'bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded uppercase';
    }
    if (banner) banner.classList.add('hidden');
}

// ==========================================
// GERAÇÃO DE PDF PROFISSIONAL (jsPDF)
// ==========================================
function generatePDFReport() {
    if (!lastCalc) {
        showToast('Realize um cálculo válido antes de baixar o PDF.', 'warning');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    // Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(31, 41, 55);
    doc.text("Relatório de Precificação & DRE", 15, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("Demonstrativo Financeiro de Margens para E-commerce", 15, 26);
    doc.text(`Data: ${dataAtual}`, 195, 20, { align: 'right' });

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.line(15, 30, 195, 30);

    // Card Preço Sugerido
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(15, 35, 180, 24, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text("PREÇO DE VENDA SUGERIDO", 20, 42);

    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229);
    doc.text(formatBRL(lastCalc.targetPrice), 20, 53);

    // Título DRE
    doc.setFontSize(10.5);
    doc.setTextColor(55, 65, 81);
    doc.text("DEMONSTRATIVO DE CUSTOS & LUCRO (DRE)", 15, 69);
    doc.line(15, 71, 195, 71);

    // Tabela DRE
    doc.setFillColor(243, 244, 246);
    doc.rect(15, 75, 180, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(17, 24, 39);
    doc.text("Item de Custo / Taxa", 20, 80.5);
    doc.text("Valor (R$)", 190, 80.5, { align: 'right' });

    const rows = [
        ["Custo Base do Produto", formatBRL(lastCalc.cost)],
        ["Frete / Envio", formatBRL(lastCalc.shipping)],
        ["Taxa Fixa da Venda", formatBRL(lastCalc.fixedFee)],
        [`Comissão Plataforma (${(lastCalc.feePerc * 100).toFixed(1)}%)`, formatBRL(lastCalc.targetPrice * lastCalc.feePerc)],
        [`Impostos / Simples (${(lastCalc.taxPerc * 100).toFixed(1)}%)`, formatBRL(lastCalc.targetPrice * lastCalc.taxPerc)]
    ];

    let y = 83;
    doc.setFontSize(9);

    rows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text(label, 20, y + 6);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text(value, 190, y + 6, { align: 'right' });

        doc.setDrawColor(243, 244, 246);
        doc.line(15, y + 9, 195, y + 9);
        y += 9;
    });

    // Linha Final: Lucro Líquido
    doc.setFillColor(236, 253, 245);
    doc.rect(15, y + 2, 180, 10, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(6, 95, 70);
    doc.text("Lucro Líquido Final", 20, y + 8.5);
    doc.text(formatBRL(lastCalc.profit), 190, y + 8.5, { align: 'right' });

    // Rodapé
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text("Este relatório é um demonstrativo financeiro gerado automaticamente pelo PrecificaPro.", 105, y + 24, { align: 'center' });

    doc.save('Relatorio_Precificacao_PrecificaPro.pdf');
    trackEvent('calculadora_pdf_baixado');
}

// ==========================================
// CAPTURA DE LEADS (WEBHOOK MAKE)
// ==========================================
async function handleLeadSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('lead-email');
    const email = emailInput ? emailInput.value.trim() : '';
    if (!email) return;

    localStorage.setItem('precifica_lead_email', email);
    trackEvent('calculadora_lead_capturado', { email });

    try {
        await fetch(API_LEAD_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, user_id: getUserId(), timestamp: new Date().toISOString() }),
            signal: AbortSignal.timeout(4000)
        });
    } catch (err) {
        console.warn('Falha no webhook. Guardado em fallback local.', err);
        let offlineLeads = JSON.parse(localStorage.getItem('precifica_offline_leads') || '[]');
        offlineLeads.push({ email, date: new Date().toISOString() });
        localStorage.setItem('precifica_offline_leads', JSON.stringify(offlineLeads));
    }

    showToast('Sucesso! O seu Guia Gratuito foi liberado.');
    if (emailInput) emailInput.value = '';
    const btnLead = document.getElementById('btn-lead');
    if (btnLead) {
        btnLead.textContent = '✓ Guia Enviado!';
        btnLead.className = 'online-required bg-slate-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition whitespace-nowrap';
    }
}

// ==========================================
// UTILITÁRIOS, OFFLINE & UI
// ==========================================
function checkOnlineStatus() {
    const offlineBanner = document.getElementById('offline-banner');
    const onlineBtns = document.querySelectorAll('.online-required');

    if (!navigator.onLine) {
        if (offlineBanner) offlineBanner.classList.remove('hidden');
        onlineBtns.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        });
        showToast('Modo Offline: Verifique a sua conexão à internet.', 'warning');
    } else {
        if (offlineBanner) offlineBanner.classList.add('hidden');
        onlineBtns.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        });
    }
}

window.addEventListener('online', checkOnlineStatus);
window.addEventListener('offline', checkOnlineStatus);

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastBody = document.getElementById('toast-body');

    if (!toast || !toastMsg || !toastBody) return;
    toastMsg.textContent = msg;

    if (type === 'warning') {
        toastBody.className = 'bg-amber-500 text-slate-950 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-semibold';
    } else if (type === 'error') {
        toastBody.className = 'bg-rose-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-semibold';
    } else {
        toastBody.className = 'bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-medium';
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 4000);
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}
