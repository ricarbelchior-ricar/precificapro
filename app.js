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

// 🏆 RENDERIZAÇÃO VETORIAL NATIVA EM MEMÓRIA (SEM SCREENSHOTS OU HTML2CANVAS)
function generatePDF() {
    if (!lastCalc) {
        alert("Por favor, clique em 'Calcular Preço Ideal' antes de exportar o PDF.");
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("Erro ao carregar o gerador de PDF. Verifique a ligação à internet.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const dataAtual = new Date().toLocaleDateString('pt-BR');

    // 1. Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(49, 46, 129); // #312e81
    doc.text("Relatório de Precificação - PrecificaPro", 15, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128); // #6b7280
    doc.text("Demonstrativo Financeiro de Margens para E-commerce", 15, 26);
    doc.text(`Data: ${dataAtual}`, 195, 20, { align: 'right' });

    // Linha divisória do topo
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.line(15, 30, 195, 30);

    // 2. Card Preço Sugerido
    doc.setFillColor(243, 244, 246); // #f3f4f6
    doc.roundedRect(15, 35, 180, 24, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text("PREÇO DE VENDA SUGERIDO", 20, 42);

    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // #4f46e5
    doc.text(formatBRL(lastCalc.targetPrice), 20, 53);

    // 3. Título DRE
    doc.setFontSize(10.5);
    doc.setTextColor(55, 65, 81);
    doc.text("DEMONSTRATIVO DE CUSTOS & LUCRO (DRE)", 15, 69);
    doc.line(15, 71, 195, 71);

    // 4. Tabela DRE
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
    doc.setFillColor(236, 253, 245); // #ecfdf5
    doc.rect(15, y + 2, 180, 10, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(6, 95, 70); // #065f46
    doc.text("Lucro Líquido Final", 20, y + 8.5);
    doc.text(formatBRL(lastCalc.profit), 190, y + 8.5, { align: 'right' });

    // 5. Rodapé
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text("Este relatório é um demonstrativo financeiro gerado automaticamente pelo PrecificaPro.", 105, y + 24, { align: 'center' });

    // Transferência direta instantânea
    doc.save('Relatorio_Precificacao_PrecificaPro.pdf');
}

function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}
