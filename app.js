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
    if (btnPdf) btnPdf.innerHTML = "⏳ A gerar relatório final...";

    const dataAtual = new Date().toLocaleDateString('pt-BR');

    // 1. Guarda o scroll e sobe para o topo
    const scrollOriginal = window.scrollY;
    window.scrollTo(0, 0);

    // 2. Cria o contentor com ALTURA FORÇADA GIGANTE (1500px) para não cortar em telemóveis!
    const pdfContainer = document.createElement('div');
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.top = '0';
    pdfContainer.style.left = '0';
    pdfContainer.style.width = '800px';
    pdfContainer.style.height = '1500px'; // O TRUQUE MÁGICO CONTRA O CORTE
    pdfContainer.style.backgroundColor = '#ffffff';
    pdfContainer.style.zIndex = '999999';
    pdfContainer.style.padding = '40px';
    pdfContainer.style.boxSizing = 'border-box';
    
    pdfContainer.innerHTML = `
        <div style="font-family: Arial, sans-serif; color: #111827;">
            <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 style="font-size: 22px; font-weight: bold; color: #312e81; margin: 0;">Relatório de Precificação - PrecificaPro</h1>
                    <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0;">Demonstrativo Financeiro de Margens para E-commerce</p>
                </div>
                <div style="font-size: 12px; color: #9ca3af;">Data: ${dataAtual}</div>
            </div>

            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <span style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: bold; display: block;">Preço de Venda Sugerido</span>
                <div style="font-size: 32px; font-weight: 800; color: #4f46e5; margin-top: 4px;">${formatBRL(lastCalc.targetPrice)}</div>
            </div>

            <h3 style="font-size: 15px; font-weight: bold; text-transform: uppercase; color: #374151; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Demonstrativo de Custos & Lucro (DRE)</h3>
            
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #f3f4f6;">
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #d1d5db;">Item de Custo / Taxa</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 1px solid #d1d5db;">Valor (R$)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 12px; text-align: left;">Custo Base do Produto</td><td style="padding: 12px; text-align: right; font-weight: bold;">${formatBRL(lastCalc.cost)}</td></tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 12px; text-align: left;">Frete / Envio</td><td style="padding: 12px; text-align: right; font-weight: bold;">${formatBRL(lastCalc.shipping)}</td></tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 12px; text-align: left;">Taxa Fixa da Venda</td><td style="padding: 12px; text-align: right; font-weight: bold;">${formatBRL(lastCalc.fixedFee)}</td></tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 12px; text-align: left;">Comissão Plataforma (${(lastCalc.feePerc * 100).toFixed(1)}%)</td><td style="padding: 12px; text-align: right; font-weight: bold;">${formatBRL(lastCalc.targetPrice * lastCalc.feePerc)}</td></tr>
                    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 12px; text-align: left;">Impostos / Simples (${(lastCalc.taxPerc * 100).toFixed(1)}%)</td><td style="padding: 12px; text-align: right; font-weight: bold;">${formatBRL(lastCalc.targetPrice * lastCalc.taxPerc)}</td></tr>
                    <tr style="background-color: #ecfdf5;"><td style="padding: 16px; text-align: left; font-size: 15px; font-weight: bold; color: #065f46;">Lucro Líquido Final</td><td style="padding: 16px; text-align: right; font-size: 15px; font-weight: bold; color: #065f46;">${formatBRL(lastCalc.profit)}</td></tr>
                </tbody>
            </table>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">Este relatório é um demonstrativo financeiro gerado automaticamente pelo PrecificaPro.</p>
            </div>
        </div>
    `;

    document.body.appendChild(pdfContainer);

    // Dá o tempo de o telemóvel desenhar a "folha" gigante invisível
    await new Promise(resolve => setTimeout(resolve, 350));

    const opt = {
        margin:       10,
        filename:     'Relatorio_Precificacao_PrecificaPro.pdf',
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { 
            scale: 2, 
            logging: false, 
            useCORS: true,
            scrollY: 0,
            windowWidth: 800,
            windowHeight: 1500 // DIZ AO MOTOR FOTOGRÁFICO PARA USAR 1500px EM VEZ DO ECRÃ DO TELEMÓVEL!
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(pdfContainer).save();
    } catch (err) {
        console.error("Erro ao gerar PDF:", err);
        alert("Ocorreu um erro ao gerar o PDF. Tente novamente.");
    } finally {
        document.body.removeChild(pdfContainer);
        window.scrollTo(0, scrollOriginal);
        if (btnPdf) btnPdf.innerHTML = originalBtnText;
    }
}

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}
