// ==========================================
// CONFIGURAÇÕES GLOBAIS
// ==========================================
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/fZu00i6jVaHD26W1gB4ow00';
const MAKE_WEBHOOK_URL = 'https://hook.eu1.make.com/fveqo8xjv6mtt8a44w6jxapu1viwoa2j';

let lastCalc = null;
let isUnlocked = false;

// ==========================================
// INICIALIZAÇÃO E VERIFICAÇÃO DE DESBLOQUEIO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Verifica se o utilizador acabou de pagar no Stripe
    const params = new URLSearchParams(window.location.search);
    if (params.get('unlocked') === 'true' || localStorage.getItem('precificapro_unlocked') === 'true') {
        localStorage.setItem('precificapro_unlocked', 'true');
        isUnlocked = true;
        revealResults();
    }

    // Adiciona os listeners aos formulários e botões
    const calcForm = document.getElementById('calc-form');
    if (calcForm) {
        calcForm.addEventListener('submit', function(e) {
            e.preventDefault();
            calculate();
        });
    }

    const btnPdf = document.getElementById('btn-pdf');
    if (btnPdf) {
        btnPdf.addEventListener('click', generatePDF);
    }
    
    const leadForm = document.getElementById('lead-form');
    if (leadForm) {
        leadForm.addEventListener('submit', handleLeadSubmit);
    }
});

// ==========================================
// LÓGICA DE CÁLCULO E MATEMÁTICA
// ==========================================
function calculate() {
    // 1. Captura e limpa os valores inseridos
    const cost = parseFloat(document.getElementById('cost')?.value) || 0;
    const shipping = parseFloat(document.getElementById('shipping')?.value) || 0;
    const fixedFee = parseFloat(document.getElementById('fixedFee')?.value) || 0;
    const feePerc = (parseFloat(document.getElementById('fee')?.value) || 0) / 100;
    const taxPerc = (parseFloat(document.getElementById('tax')?.value) || 0) / 100;
    const marginPerc = (parseFloat(document.getElementById('margin')?.value) || 0) / 100;

    const totalFixedCost = cost + shipping + fixedFee;
    const totalVariablePerc = feePerc + taxPerc + marginPerc;

    // Proteção contra matemática impossível
    if (totalVariablePerc >= 1) {
        alert("A soma das taxas (%) e margem não pode ultrapassar 100%.");
        return;
    }

    // 2. Fórmulas de Precificação
    const targetPrice = totalFixedCost / (1 - totalVariablePerc);
    const minPrice = totalFixedCost / (1 - (feePerc + taxPerc));
    const profit = targetPrice * marginPerc;

    // Grava os dados para o PDF
    lastCalc = { cost, shipping, fixedFee, feePerc, taxPerc, marginPerc, targetPrice, minPrice, profit };

    // 3. Atualizar a Interface (UI)
    const resTarget = document.getElementById('res-target');
    const resMin = document.getElementById('res-min');
    const resProfit = document.getElementById('res-profit');
    const resMargin = document.getElementById('res-margin');

    if(resTarget) resTarget.textContent = formatCurrency(targetPrice);
    if(resMin) resMin.textContent = formatCurrency(minPrice);
    if(resProfit) resProfit.textContent = formatCurrency(profit);
    if(resMargin) resMargin.textContent = (marginPerc * 100).toFixed(1) + "%";

    // 4. Mostrar Resultados (Focados ou Desfocados)
    if (isUnlocked) {
        revealResults();
    } else {
        const resultBox = document.getElementById('result-box');
        if(resultBox) resultBox.classList.remove('hidden');
    }
}

// ==========================================
// DESBLOQUEIO DE ECRÃ PÓS-PAGAMENTO
// ==========================================
function revealResults() {
    // Remove o blur dos números
    document.querySelectorAll('.blurred-text').forEach(el => el.classList.remove('blurred-text'));
    
    // Esconde o botão do Stripe e mostra a zona de PDF
    const lockedOverlay = document.getElementById('locked-overlay');
    if(lockedOverlay) lockedOverlay.classList.add('hidden');
    
    const unlockedZone = document.getElementById('unlocked-zone');
    if(unlockedZone) unlockedZone.classList.remove('hidden');
}

// ==========================================
// CAPTURA DE LEADS (MAKE WEBHOOK)
// ==========================================
async function handleLeadSubmit(e) {
    e.preventDefault();

    const emailInput = document.getElementById('lead-email') || document.getElementById('leadEmail');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email) return;

    const btn = document.getElementById('btn-lead') || document.getElementById('btnLead');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'A processar...';
    }

    const urlParams = new URLSearchParams(window.location.search);

    try {
        const response = await fetch(MAKE_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                event_type: "lead_gratuito",
                data: {
                    nome: "Lead PrecificaPro", 
                    email: email,
                    telefone: "",
                    origem: urlParams.get('utm_source') || "organico",
                    campanha: urlParams.get('utm_campaign') || "lancamento",
                    midia: urlParams.get('utm_medium') || "direto",
                    conteudo: urlParams.get('utm_content') || "",
                    termo: urlParams.get('utm_term') || "",
                    pagina_entrada: window.location.href
                }
            })
        });

        if (response.ok) {
            console.log("Lead registada com sucesso na infraestrutura Make!");
            alert("Sucesso! O seu guia/passaporte está a caminho do email.");
        } else {
            console.error("Erro na comunicação com o servidor.");
        }
    } catch (error) {
        console.warn("Falha de rede, a ativar modo offline (fallback):", error);
        alert("Sucesso! Operação registada localmente.");
    } finally {
        localStorage.setItem('mkp_user_email', email);
        if (emailInput) emailInput.value = '';
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✓ Enviado';
        }
    }
}

// ==========================================
// GERAÇÃO DO RELATÓRIO PDF (html2pdf)
// ==========================================
function generatePDF() {
    if (!lastCalc) {
        alert("Por favor, realize um cálculo na ferramenta antes de exportar o PDF.");
        return;
    }

    const pdfDate = document.getElementById('pdf-date');
    if(pdfDate) pdfDate.textContent = "Data: " + new Date().toLocaleDateString('pt-PT');
    
    const pdfTarget = document.getElementById('pdf-target-price');
    if(pdfTarget) pdfTarget.textContent = formatCurrency(lastCalc.targetPrice);

    const tbody = document.getElementById('pdf-table-body');
    if(tbody) {
        tbody.innerHTML = `
            <tr><td class="p-2">Custo Base do Produto</td><td class="p-2 text-right">${formatCurrency(lastCalc.cost)}</td></tr>
            <tr><td class="p-2">Portes / Envio</td><td class="p-2 text-right">${formatCurrency(lastCalc.shipping)}</td></tr>
            <tr><td class="p-2">Taxa Fixa</td><td class="p-2 text-right">${formatCurrency(lastCalc.fixedFee)}</td></tr>
            <tr><td class="p-2">Comissão / Plataforma (${(lastCalc.feePerc * 100).toFixed(1)}%)</td><td class="p-2 text-right">${formatCurrency(lastCalc.targetPrice * lastCalc.feePerc)}</td></tr>
            <tr><td class="p-2">Impostos (${(lastCalc.taxPerc * 100).toFixed(1)}%)</td><td class="p-2 text-right">${formatCurrency(lastCalc.targetPrice * lastCalc.taxPerc)}</td></tr>
            <tr class="font-bold bg-emerald-50"><td class="p-2 text-emerald-900">Lucro Líquido Final</td><td class="p-2 text-right text-emerald-900">${formatCurrency(lastCalc.profit)}</td></tr>
        `;
    }

    const element = document.getElementById('pdf-template');
    if(element) {
        const opt = {
            margin: 10,
            filename: 'Relatorio_Precificacao_PrecificaPro.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    }
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function formatCurrency(val) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val || 0);
}

// Expor funções para chamadas diretas no HTML (botões e formulários)
window.calculate = calculate;
window.generatePDF = generatePDF;
window.handleLeadSubmit = handleLeadSubmit;
