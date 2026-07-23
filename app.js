let lastCalc = null;
let isUnlocked = false;

// Gestão de Paywall & Validade de 30 dias no localStorage
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

// Inicialização dos Eventos após carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calc-form');
    const pdfBtn = document.getElementById('btn-pdf');

    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); calculate(); });
    if (pdfBtn) pdfBtn.addEventListener('click', generatePDF);

    if (isUnlocked) {
        revealResults();
    }
});

function calculate() {
    const cost = parseFloat(document.getElementById('cost').value) || 0;
    const shipping = parseFloat(document.getElementById('shipping').value) || 0;
    const fixedFee = parseFloat(document.getElementById('fixedFee').value) || 0;
    const feePerc = (parseFloat(document.getElementById('fee').value) || 0) / 100;
    const taxPerc = (parseFloat(document.getElementById('tax').value) || 0) / 100;
    const marginPerc = (parseFloat(document.getElementById('margin').value) || 0) / 100;

    const totalFixedCost = cost + shipping + fixedFee;
    const totalVariablePerc = feePerc + taxPerc + marginPerc;

    if (totalVariablePerc >= 1) {
        alert("A soma das taxas (%) e margem não pode ultrapassar 100%.");
        return;
    }

    const targetPrice = totalFixedCost / (1 - totalVariablePerc);
    const minPrice = totalFixedCost / (1 - (feePerc + taxPerc));
    const profit = targetPrice * marginPerc;
    const markup = cost > 0 ? (targetPrice / cost) : 0;

    lastCalc = { cost, shipping, fixedFee, feePerc, taxPerc, marginPerc, targetPrice, minPrice, profit, markup };

    document.getElementById('res-target').textContent = formatBRL(targetPrice);
    document.getElementById('res-min').textContent = formatBRL(minPrice);
    document.getElementById('res-profit').textContent = formatBRL(profit);
    document.getElementById('res-markup').textContent = markup.toFixed(2) + "x";

    if (isUnlocked) {
        revealResults();
    }
}

function revealResults() {
    document.querySelectorAll('.blurred-text').forEach(el => el.classList.remove('blurred-text'));
    const lockedOverlay = document.getElementById('locked-overlay');
    const unlockedZone = document.getElementById('unlocked-zone');
    if (lockedOverlay) lockedOverlay.classList.add('hidden');
    if (unlockedZone) unlockedZone.classList.remove('hidden');
}

async function generatePDF() {
    if (!lastCalc) {
        alert("Por favor, clique em 'Calcular Preço Ideal' antes de exportar o PDF.");
        return;
    }

    const btnPdf = document.getElementById('btn-pdf');
    const originalBtnText = btnPdf ? btnPdf.innerHTML : '';
    if (btnPdf) btnPdf.innerHTML = "⏳ A gerar PDF...";

    document.getElementById('pdf-date').textContent = "Data: " + new Date().toLocaleDateString('pt-BR');
    document.getElementById('pdf-target-price').textContent = formatBRL(lastCalc.targetPrice);

    const tbody = document.getElementById('pdf-table-body');
    tbody.innerHTML = `
        <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 12px; text-align: left; font-size: 12px;">Custo Base do Produto</td><td style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: bold;">${formatBRL(lastCalc.cost)}</td></tr>
        <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 12px; text-align: left; font-size: 12px;">Frete / Envio</td><td style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: bold;">${formatBRL(lastCalc.shipping)}</td></tr>
        <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 12px; text-align: left; font-size: 12px;">Taxa Fixa da Venda</td><td style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: bold;">${formatBRL(lastCalc.fixedFee)}</td></tr>
        <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 12px; text-align: left; font-size: 12px;">Comissão Plataforma (${(lastCalc.feePerc * 100).toFixed(1)}%)</td><td style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: bold;">${formatBRL(lastCalc.targetPrice * lastCalc.feePerc)}</td></tr>
        <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 10px 12px; text-align: left; font-size: 12px;">Impostos / Simples (${(lastCalc.taxPerc * 100).toFixed(1)}%)</td><td style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: bold;">${formatBRL(lastCalc.targetPrice * lastCalc.taxPerc)}</td></tr>
        <tr style="background-color: #ecfdf5;"><td style="padding: 12px; text-align: left; font-size: 13px; font-weight: bold; color: #065f46;">Lucro Líquido Final</td><td style="padding: 12px; text-align: right; font-size: 13px; font-weight: bold; color: #065f46;">${formatBRL(lastCalc.profit)}</td></tr>
    `;

    const container = document.getElementById('pdf-render-container');
    const pdfTemplate = document.getElementById('pdf-template');

    // Traz o container para a zona visível do viewport durante o screenshot
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '999999';
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';

    // Aguarda o reflow de renderização do motor móvel
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 300)));

    const opt = {
        margin: [10, 10, 10, 10],
        filename: 'Relatorio_Precificacao_PrecificaPro.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            logging: false, 
            useCORS: true,
            width: 680,
            windowWidth: 680
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(pdfTemplate).save();
    } catch (err) {
        console.error("Erro ao gerar PDF:", err);
        alert("Ocorreu um erro ao gerar o PDF. Tente novamente.");
    } finally {
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        if (btnPdf) btnPdf.innerHTML = originalBtnText;
    }
}

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}
