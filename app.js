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

// Inicialização dos Eventos
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

    // Preenche o template do PDF imediatamente após o cálculo
    updatePDFTemplate(lastCalc);

    if (isUnlocked) {
        revealResults();
    }
}

function updatePDFTemplate(calc) {
    if (!calc) return;

    document.getElementById('pdf-date').textContent = "Data: " + new Date().toLocaleDateString('pt-BR');
    document.getElementById('pdf-target-price').textContent = formatBRL(calc.targetPrice);

    const tbody = document.getElementById('pdf-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; text-align: left; font-size: 12px; color: #374151;">Custo Base do Produto</td>
                <td style="padding: 10px; text-align: right; font-size: 12px; font-weight: bold; color: #111827;">${formatBRL(calc.cost)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; text-align: left; font-size: 12px; color: #374151;">Frete / Envio</td>
                <td style="padding: 10px; text-align: right; font-size: 12px; font-weight: bold; color: #111827;">${formatBRL(calc.shipping)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; text-align: left; font-size: 12px; color: #374151;">Taxa Fixa da Venda</td>
                <td style="padding: 10px; text-align: right; font-size: 12px; font-weight: bold; color: #111827;">${formatBRL(calc.fixedFee)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; text-align: left; font-size: 12px; color: #374151;">Comissão Plataforma (${(calc.feePerc * 100).toFixed(1)}%)</td>
                <td style="padding: 10px; text-align: right; font-size: 12px; font-weight: bold; color: #111827;">${formatBRL(calc.targetPrice * calc.feePerc)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px; text-align: left; font-size: 12px; color: #374151;">Impostos / Simples (${(calc.taxPerc * 100).toFixed(1)}%)</td>
                <td style="padding: 10px; text-align: right; font-size: 12px; font-weight: bold; color: #111827;">${formatBRL(calc.targetPrice * calc.taxPerc)}</td>
            </tr>
            <tr style="background-color: #ecfdf5;">
                <td style="padding: 12px; text-align: left; font-size: 13px; font-weight: bold; color: #065f46;">Lucro Líquido Final</td>
                <td style="padding: 12px; text-align: right; font-size: 13px; font-weight: bold; color: #065f46;">${formatBRL(calc.profit)}</td>
            </tr>
        `;
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

    // Garante que o conteúdo da tabela está atualizado
    updatePDFTemplate(lastCalc);

    const template = document.getElementById('pdf-template');
    
    // Cria um clone visível do relatório temporariamente no topo da página
    const clone = template.cloneNode(true);
    clone.style.display = 'block';
    clone.style.width = '650px';
    clone.style.padding = '24px';
    clone.style.backgroundColor = '#ffffff';
    clone.style.position = 'fixed';
    clone.style.top = '0';
    clone.style.left = '0';
    clone.style.zIndex = '999999';

    document.body.appendChild(clone);

    // Pausa técnica para o browser móvel desenhar a tabela
    await new Promise(resolve => setTimeout(resolve, 200));

    const opt = {
        margin: 10,
        filename: 'Relatorio_Precificacao_PrecificaPro.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            logging: false, 
            useCORS: true,
            width: 650
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(clone).save();
    } catch (err) {
        console.error("Erro ao gerar PDF:", err);
        alert("Ocorreu um erro ao gerar o PDF. Tente novamente.");
    } finally {
        document.body.removeChild(clone);
        if (btnPdf) btnPdf.innerHTML = originalBtnText;
    }
}

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}
