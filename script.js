// ----------------------------------------------------------------------
// Variáveis Globais e Base de Motivos
// ----------------------------------------------------------------------

// Tenta carregar a base de motivos do localStorage; se não houver, usa o padrão.
let motivosChurnBase = JSON.parse(localStorage.getItem('motivosChurnBase')) || [
    "Preço Alto", 
    "Falta de Recurso/Feature", 
    "Atendimento Ruim/Lento", 
    "Concorrente Melhor",
    "Não Utilizado"
];
let meuGraficoMotivos; 
let meuGraficoRisco;   
let totalLinhas = 0; // Será recalculado ao carregar a tabela.

const MULTIPLO_VALOR_FUTURO = 12; 

// --- FUNÇÕES DE PERSISTÊNCIA DE DADOS ---

/**
 * Salva a lista de motivos e todos os dados da tabela no localStorage.
 */
function salvarDados() {
    // 1. Salva a lista mestra de motivos
    localStorage.setItem('motivosChurnBase', JSON.stringify(motivosChurnBase));
    
    // 2. Coleta e salva os dados da tabela
    // Coleta sem recalcular risco ou DOM (para ser rápido)
    const dadosClientes = coletarDadosClientes(false); 
    localStorage.setItem('dadosClientes', JSON.stringify(dadosClientes));
}

// --- FUNÇÃO DE SEGURANÇA CONTRA O ERRO 'NULL' ---
function safeSetText(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}
// ------------------------------------------------

// ----------------------------------------------------------------------
// Gerenciamento de Motivos de Churn (Lista Mestra)
// ----------------------------------------------------------------------

function renderMotivosList() {
    const ul = document.getElementById('lista-motivos-edicao');
    if (!ul) return; 

    ul.innerHTML = ''; 

    motivosChurnBase.forEach((motivo, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span id="motivo-${index}" contenteditable="true" onblur="editarMotivo(${index}, this.textContent)">${motivo}</span>
            <button onclick="removerMotivo(${index})" style="background-color: #e74c3c; padding: 5px 10px; border-radius: 3px; margin-left: 10px;">🗑️ Remover</button>
        `;
        ul.appendChild(li);
    });
    // Salva automaticamente após carregar ou modificar a lista mestra
    salvarDados(); 
}

function removerMotivo(index) {
    if (confirm(`Tem certeza que deseja remover o motivo "${motivosChurnBase[index]}"?`)) {
        motivosChurnBase.splice(index, 1);
        renderMotivosList();
        inicializarMotivosDropdowns(); 
        calcularEExibirDashboard();
    }
}

function editarMotivo(index, novoValor) {
    const valorTratado = novoValor.trim();
    const elementoMotivo = document.getElementById(`motivo-${index}`);
    
    if (!elementoMotivo) return;

    if (!valorTratado) {
        alert("O motivo não pode ser vazio.");
        elementoMotivo.textContent = motivosChurnBase[index];
        return;
    }
    
    const isDuplicate = motivosChurnBase.some((motivo, i) => i !== index && motivo === valorTratado);

    if (isDuplicate) {
        alert("Este motivo já existe!");
        elementoMotivo.textContent = motivosChurnBase[index];
    } else {
        motivosChurnBase[index] = valorTratado;
        inicializarMotivosDropdowns(); 
        renderMotivosList(); 
        calcularEExibirDashboard();
    }
}

function adicionarMotivo() {
    const input = document.getElementById('novo-motivo');
    if (!input) return;

    const novoMotivo = input.value.trim();

    if (novoMotivo && !motivosChurnBase.includes(novoMotivo)) {
        motivosChurnBase.push(novoMotivo);
        input.value = ''; 
        alert(`Motivo "${novoMotivo}" adicionado!`);
        
        renderMotivosList(); 
        inicializarMotivosDropdowns(); 
        calcularEExibirDashboard();
    } else if (novoMotivo) {
        alert(`O motivo "${novoMotivo}" já existe!`);
    }
}

// ----------------------------------------------------------------------
// Visualização e Edição de Motivos (Tags)
// ----------------------------------------------------------------------

/**
 * Renderiza os motivos selecionados como tags visíveis no display.
 */
function renderMotivoTags(linha) {
    const statusSelect = linha.querySelector('.status');
    const motivoSelect = linha.querySelector('.motivo-churn-select'); 
    const tagsContainer = linha.querySelector('.motivo-churn-tags');
    const editBtn = linha.querySelector('.motivo-churn-edit-btn');
    
    tagsContainer.innerHTML = '';
    
    if (statusSelect.value !== 'Churn') {
        tagsContainer.textContent = "Cliente Ativo";
        tagsContainer.classList.add('motivo-ativo');
        editBtn.style.display = 'none';
        
        // Garante que o select escondido esteja limpo
        Array.from(motivoSelect.options).forEach(opt => opt.selected = false);
        return;
    }
    
    tagsContainer.classList.remove('motivo-ativo');
    editBtn.style.display = 'inline-block';

    const selectedOptions = Array.from(motivoSelect.options).filter(opt => opt.selected && opt.value !== 'N/A');
    
    if (selectedOptions.length === 0) {
        tagsContainer.textContent = "Nenhum motivo selecionado";
        tagsContainer.style.fontStyle = 'italic';
        tagsContainer.style.color = '#7f8c8d';
        return;
    }
    
    tagsContainer.style.fontStyle = 'normal';
    tagsContainer.style.color = 'inherit';
    selectedOptions.forEach(option => {
        const tag = document.createElement('span');
        tag.className = 'motivo-tag';
        tag.textContent = option.value;
        tagsContainer.appendChild(tag);
    });
}

/**
 * Abre uma caixa de diálogo simplificada para o usuário selecionar múltiplos motivos de churn.
 */
function editarMotivos(button) {
    const linha = button.closest('tr');
    const motivoSelect = linha.querySelector('.motivo-churn-select');
    
    // Pega a seleção atual para mostrar na instrução
    let currentSelection = Array.from(motivoSelect.options)
        .filter(opt => opt.selected && opt.value !== 'N/A')
        .map(opt => opt.value);
        
    // Lista os motivos com números para seleção
    let motivoList = motivosChurnBase.map((motivo, index) => 
        `${index + 1}: ${motivo}`
    ).join('\n');
    
    const instrucao = `Selecione os números dos motivos (separados por vírgula) para ${linha.querySelector('.nome-cliente').value}:\n\n${motivoList}\n\nMotivos Atuais: ${currentSelection.join(', ') || 'Nenhum'}\n\n(Ex: 1, 3, 5)`;

    const userInput = prompt(instrucao);

    if (userInput !== null) {
        // Converte a entrada do usuário para índices válidos (base 1 para o usuário)
        const selectedIndices = userInput.split(',')
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n) && n > 0 && n <= motivosChurnBase.length);

        // 1. Limpa todas as seleções no select escondido
        Array.from(motivoSelect.options).forEach(opt => opt.selected = false);

        // 2. Aplica as novas seleções
        selectedIndices.forEach(index => {
            const motive = motivosChurnBase[index - 1];
            const optionToSelect = Array.from(motivoSelect.options).find(opt => opt.value === motive);
            if (optionToSelect) {
                optionToSelect.selected = true;
            }
        });
        
        // 3. Atualiza o visual e salva
        renderMotivoTags(linha);
        calcularEExibirDashboard();
        salvarDados();
    }
}


// ----------------------------------------------------------------------
// Funções de Interface (DOM) e Tabela
// ----------------------------------------------------------------------

/**
 * Inicializa os dropdowns e adiciona listeners para salvar dados.
 * @param {Element | null} [targetLine=null] - A linha específica a ser inicializada (ou todas se for null).
 */
function inicializarMotivosDropdowns(targetLine = null) {
    const lines = targetLine ? [targetLine] : document.querySelectorAll('.motivo-churn-wrapper');
    
    lines.forEach(wrapperOrLine => {
        const wrapper = wrapperOrLine.classList.contains('motivo-churn-wrapper') ? wrapperOrLine : wrapperOrLine.querySelector('.motivo-churn-wrapper');
        if (!wrapper) return;
        
        const select = wrapper.querySelector('.motivo-churn-select');
        const linha = wrapper.closest('tr');
        const statusSelect = linha.querySelector('.status');
        
        // Step 1: Manage Select Options (Hidden)
        const valoresAtuais = Array.from(select.options)
                                 .filter(option => option.selected)
                                 .map(option => option.value);

        select.innerHTML = '';
        
        const optNA = document.createElement('option');
        optNA.value = 'N/A';
        optNA.textContent = 'N/A';
        select.appendChild(optNA);

        motivosChurnBase.forEach(motivo => {
            const option = document.createElement('option');
            option.value = motivo;
            option.textContent = motivo;
            select.appendChild(option);
        });
        
        Array.from(select.options).forEach(option => {
            if (valoresAtuais.includes(option.value)) {
                option.selected = true;
            }
        });

        // Step 2: Attach Listeners (se não estiverem anexados)
        if (!statusSelect.hasAttribute('data-listener-attached')) {
            statusSelect.addEventListener('change', function() {
                const linha = this.closest('tr');
                renderMotivoTags(linha); 
                calcularEExibirDashboard();
                salvarDados(); 
            });
            statusSelect.setAttribute('data-listener-attached', 'true');
        }
        
        // Adiciona listeners para os campos que afetam o risco (para salvar dados)
        ['.nome-cliente', '.valor-mensal', '.tempo-uso', '.engajamento', '.satisfeito'].forEach(selector => {
            const element = linha.querySelector(selector);
            if (element && !element.hasAttribute('data-save-listener')) {
                element.addEventListener('change', () => {
                    calcularEExibirDashboard(); // Recalcula Risco
                    salvarDados(); 
                });
                // Garante que inputs de texto e número salvem ao perder o foco (blur)
                 if (element.tagName === 'INPUT') {
                    element.addEventListener('blur', () => salvarDados());
                }
                element.setAttribute('data-save-listener', 'true');
            }
        });

        // Step 3: Apply Initial State and Render Tags
        renderMotivoTags(linha);
    });
}

function adicionarLinha() {
    totalLinhas++;
    const tabela = document.getElementById('tabela-clientes');
    if (!tabela) return;

    const tbody = tabela.querySelector('tbody');
    if (!tbody) return;
    
    const novaLinha = tbody.insertRow();
    novaLinha.id = `linha-nova-${totalLinhas}`;

    novaLinha.innerHTML = `
        <td><input type="text" class="nome-cliente" value="Novo Cliente ${totalLinhas}"></td>
        <td>
            <select class="status">
                <option selected>Ativo</option>
                <option>Churn</option>
            </select>
        </td>
        <td><select class="engajamento"><option selected>Engajado</option><option>Neutro</option><option>Desengajado</option></select></td>
        <td><select class="satisfeito"><option selected>Sim</option><option>Não</option></select></td>
        <td><input type="number" class="valor-mensal" value="100" min="0"></td>
        
        <td>
            <div class="motivo-churn-wrapper">
                <select class="motivo-churn-select" multiple style="display:none;"></select> 
                <div class="motivo-churn-tags"></div> 
                <button class="motivo-churn-edit-btn" onclick="editarMotivos(this)">Selecionar Motivos</button>
            </div>
        </td>
        
        <td><input type="number" class="tempo-uso" value="3" min="1"></td>
        <td><button onclick="removerLinha(this)">🗑️</button></td>
    `;
    
    inicializarMotivosDropdowns(novaLinha);
    calcularEExibirDashboard();
    salvarDados();
}

// FUNÇÃO: Remove uma linha da tabela
function removerLinha(button) {
    const linha = button.closest('tr');
    const nomeCliente = linha.querySelector('.nome-cliente').value.trim() || "este cliente";

    if (confirm(`Tem certeza que deseja remover ${nomeCliente} da lista?`)) {
        linha.remove();
        calcularEExibirDashboard();
        salvarDados();
    }
}


/**
 * Adiciona uma nova linha na tabela com base nos dados fornecidos.
 * Usado para carregar dados salvos.
 */
function adicionarLinhaComDados(dados) {
    const tabela = document.getElementById('tabela-clientes');
    if (!tabela) return;

    const tbody = tabela.querySelector('tbody');
    if (!tbody) return;
    
    const novaLinha = tbody.insertRow();
    
    totalLinhas++;

    novaLinha.innerHTML = `
        <td><input type="text" class="nome-cliente" value="${dados.nome}"></td>
        <td>
            <select class="status">
                <option value="Ativo" ${dados.status === 'Ativo' ? 'selected' : ''}>Ativo</option>
                <option value="Churn" ${dados.status === 'Churn' ? 'selected' : ''}>Churn</option>
            </select>
        </td>
        <td><select class="engajamento">
            <option value="Engajado" ${dados.engajamento === 'Engajado' ? 'selected' : ''}>Engajado</option>
            <option value="Neutro" ${dados.engajamento === 'Neutro' ? 'selected' : ''}>Neutro</option>
            <option value="Desengajado" ${dados.engajamento === 'Desengajado' ? 'selected' : ''}>Desengajado</option>
        </select></td>
        <td><select class="satisfeito">
            <option value="Sim" ${dados.satisfeito === 'Sim' ? 'selected' : ''}>Sim</option>
            <option value="Não" ${dados.satisfeito === 'Não' ? 'selected' : ''}>Não</option>
        </select></td>
        <td><input type="number" class="valor-mensal" value="${dados.valorMensal}" min="0"></td>
        
        <td>
            <div class="motivo-churn-wrapper">
                <select class="motivo-churn-select" multiple style="display:none;"></select> 
                <div class="motivo-churn-tags"></div> 
                <button class="motivo-churn-edit-btn" onclick="editarMotivos(this)">Selecionar Motivos</button>
            </div>
        </td>
        
        <td><input type="number" class="tempo-uso" value="${dados.tempoUsoMeses}" min="1"></td>
        <td><button onclick="removerLinha(this)">🗑️</button></td>
    `;
    
    // Configura os motivos selecionados no select escondido
    const motivoSelect = novaLinha.querySelector('.motivo-churn-select');
    if (dados.motivoChurn && Array.isArray(dados.motivoChurn)) {
        // Primeiro, popula o select com as opções atuais
        inicializarMotivosDropdowns(novaLinha);
        
        // Depois, marca as opções salvas como selecionadas
        Array.from(motivoSelect.options).forEach(option => {
            if (dados.motivoChurn.includes(option.value)) {
                option.selected = true;
            }
        });
    }
    
    // Chama a inicialização para adicionar listeners e renderizar tags
    inicializarMotivosDropdowns(novaLinha);
}

/**
 * Carrega os dados salvos e reconstrói a tabela.
 */
function carregarDadosEAtualizarTabela() {
    const tbody = document.getElementById('tabela-clientes')?.querySelector('tbody');
    if (!tbody) return;

    let dadosClientesSalvos = JSON.parse(localStorage.getItem('dadosClientes'));
    
    // Se houver dados salvos, remove os exemplos e carrega os dados
    if (dadosClientesSalvos && dadosClientesSalvos.length > 0) {
        tbody.innerHTML = ''; // Limpa o conteúdo original (incluindo exemplos)
        dadosClientesSalvos.forEach(dados => adicionarLinhaComDados(dados));
        totalLinhas = dadosClientesSalvos.length;
    } else {
        // Se não houver dados salvos, apenas conta as linhas de exemplo
        totalLinhas = tbody.querySelectorAll('tr').length;
        // Inicia listeners e tags para as linhas de exemplo se existirem
        inicializarMotivosDropdowns(); 
    }
}


// ----------------------------------------------------------------------
// Funções de Processamento de Dados (COLETA E RISCO)
// ----------------------------------------------------------------------

/**
 * Coleta os dados da tabela.
 * @param {boolean} [incluirRisco=true] - Se deve calcular o risco e aplicar classes de cor.
 */
function coletarDadosClientes(incluirRisco = true) {
    const tabela = document.getElementById('tabela-clientes');
    if (!tabela) return [];
    
    const linhas = tabela.querySelectorAll('tbody tr');
    const dados = [];

    linhas.forEach(linha => {
        const nome = linha.querySelector('.nome-cliente')?.value.trim() || 'N/A';
        const status = linha.querySelector('.status')?.value || 'Ativo';
        const engajamento = linha.querySelector('.engajamento')?.value || 'Engajado'; 
        const satisfeito = linha.querySelector('.satisfeito')?.value || 'Sim'; 
        const valorMensal = parseFloat(linha.querySelector('.valor-mensal')?.value) || 0;
        const tempoUso = parseInt(linha.querySelector('.tempo-uso')?.value) || 0;
        
        const motivoChurnSelect = linha.querySelector('.motivo-churn-select');
        let motivosSelecionados = [];

        if (motivoChurnSelect) {
            Array.from(motivoChurnSelect.options).forEach(option => {
                if (option.selected && option.value !== 'N/A') {
                    motivosSelecionados.push(option.value);
                }
            });
        }
        const motivosChurn = (status === 'Churn' && motivosSelecionados.length > 0) ? motivosSelecionados : null;
        
        let risco = 0;
        let nivelRisco = status === 'Churn' ? 'CHURN' : 'Baixo';
        
        if (incluirRisco) {
            linha.classList.remove('risco-alto', 'risco-medio', 'risco-baixo');
            
            if (status === 'Ativo') { 
                if (valorMensal < 100) { risco += 10; } 
                if (tempoUso < 4) { risco += 15; }     
                if (engajamento === 'Desengajado') { risco += 25; }
                else if (engajamento === 'Neutro') { risco += 10; }
                if (satisfeito === 'Não') { risco += 30; } 

                if (risco > 50) { 
                    nivelRisco = 'Alto';
                    linha.classList.add('risco-alto');
                } else if (risco > 20) { 
                    nivelRisco = 'Médio';
                    linha.classList.add('risco-medio');
                } else { 
                    nivelRisco = 'Baixo';
                    linha.classList.add('risco-baixo');
                }
            }
        } 

        dados.push({
            nome: nome,
            status: status,
            engajamento: engajamento,
            satisfeito: satisfeito,
            valorMensal: valorMensal,
            motivoChurn: motivosChurn, 
            tempoUsoMeses: tempoUso,
            pontuacaoRisco: risco,
            nivelRisco: nivelRisco
        });
    });

    return dados;
}

function calcularIndicadores(dados) {
    let clientesChurn = dados.filter(c => c.status === "Churn");
    let clientesAtivos = dados.filter(c => c.status === "Ativo");

    let totalClientes = dados.length;
    let totalClientesChurn = clientesChurn.length;
    let totalClientesAtivos = clientesAtivos.length;

    let churnRate = (totalClientes > 0) 
        ? (totalClientesChurn / totalClientes) * 100 
        : 0;
    
    let mrrLost = clientesChurn.reduce((soma, cliente) => soma + cliente.valorMensal, 0);
    let mrrAtivo = clientesAtivos.reduce((soma, cliente) => soma + cliente.valorMensal, 0);

    let perdaValorFuturaEstimada = mrrLost * MULTIPLO_VALOR_FUTURO;
    let mrrFuturoTotal = (mrrAtivo + mrrLost) * MULTIPLO_VALOR_FUTURO;
    
    let impactoPerdaValorFuturo = 0;

    if (mrrFuturoTotal > 0) {
        impactoPerdaValorFuturo = (perdaValorFuturaEstimada / mrrFuturoTotal) * 100;
    } 

    let contagemMotivos = {};
    clientesChurn.forEach(cliente => {
        if (cliente.motivoChurn && Array.isArray(cliente.motivoChurn)) {
            cliente.motivoChurn.forEach(motivo => {
                contagemMotivos[motivo] = (contagemMotivos[motivo] || 0) + 1;
            });
        }
    });

    let distribuicaoRisco = { "Baixo": 0, "Médio": 0, "Alto": 0 };
    
    clientesAtivos.forEach(cliente => {
        distribuicaoRisco[cliente.nivelRisco]++;
    });

    return {
        totalClientes: totalClientes,
        totalClientesChurn: totalClientesChurn,
        totalClientesAtivos: totalClientesAtivos,
        churnRate: churnRate,
        mrrLost: mrrLost,
        impactoPerdaValorFuturo: impactoPerdaValorFuturo,
        distribuicaoMotivos: contagemMotivos,
        distribuicaoRisco: distribuicaoRisco
    };
}

function exibirDashboard(resultados, dadosClientes) {
    safeSetText('total-ativos', resultados.totalClientesAtivos);
    safeSetText('total-churn', resultados.totalClientesChurn);
    safeSetText('churn-rate', `${resultados.churnRate.toFixed(2)}%`);
    safeSetText('mrr-lost', `R$ ${resultados.mrrLost.toFixed(2)}`);
    safeSetText('perda-valor-futuro', `${resultados.impactoPerdaValorFuturo.toFixed(2)}%`); 
    
    exibirGraficoMotivos(resultados.distribuicaoMotivos);
    exibirGraficoRisco(resultados.distribuicaoRisco);
    
    exibirListaRisco(dadosClientes);
}

function exibirListaRisco(dadosClientes) {
    const clientesAtivos = dadosClientes.filter(c => c.status === 'Ativo');

    const listas = {
        'Alto': document.getElementById('lista-risco-alto'),
        'Médio': document.getElementById('lista-risco-medio'),
        'Baixo': document.getElementById('lista-risco-baixo')
    };

    Object.keys(listas).forEach(nivel => {
        if (listas[nivel]) {
            listas[nivel].innerHTML = '';
        }
    });

    clientesAtivos.forEach(cliente => {
        const nivel = cliente.nivelRisco;
        const lista = listas[nivel];

        if (lista) {
            const li = document.createElement('li');
            li.textContent = `${cliente.nome} (R$ ${cliente.valorMensal.toFixed(2)})`;
            lista.appendChild(li);
        }
    });

    Object.keys(listas).forEach(nivel => {
        if (listas[nivel] && listas[nivel].children.length === 0) {
             const li = document.createElement('li');
             li.textContent = `Nenhum cliente em Risco ${nivel}.`;
             listas[nivel].appendChild(li);
        }
    });
}

function exibirGraficoMotivos(contagemMotivos) {
    const motivos = Object.keys(contagemMotivos);
    const contagens = Object.values(contagemMotivos);
    const chartElement = document.getElementById('motivosChurnChart');
    const semDadosMotivo = document.getElementById('sem-dados-motivo');

    if (semDadosMotivo) {
        semDadosMotivo.style.display = (motivos.length > 0) ? 'none' : 'block';
    }

    if (!chartElement) return;

    const ctx = chartElement.getContext('2d');
    
    if (meuGraficoMotivos) {
        meuGraficoMotivos.destroy();
    }

    if (motivos.length > 0) {
        meuGraficoMotivos = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: motivos,
                datasets: [{
                    label: 'Contagem de Churn por Motivo',
                    data: contagens,
                    backgroundColor: [
                        'rgba(231, 76, 60, 0.7)',  
                        'rgba(52, 152, 219, 0.7)', 
                        'rgba(241, 196, 15, 0.7)', 
                        'rgba(46, 204, 113, 0.7)', 
                        'rgba(155, 89, 182, 0.7)', 
                        'rgba(230, 126, 34, 0.7)', 
                        'rgba(149, 165, 166, 0.7)' 
                    ],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribuição Percentual de Motivos de Churn'
                    }
                }
            }
        });
    }
}

function exibirGraficoRisco(distribuicaoRisco) {
    const labels = Object.keys(distribuicaoRisco);
    const dados = Object.values(distribuicaoRisco);
    const totalRisco = dados.reduce((sum, current) => sum + current, 0);
    const chartElement = document.getElementById('riscoChurnChart');
    const semDadosRisco = document.getElementById('sem-dados-risco');
    
    if (semDadosRisco) {
        semDadosRisco.style.display = (totalRisco > 0) ? 'none' : 'block';
    }

    if (!chartElement) return;

    const ctx = chartElement.getContext('2d');

    if (meuGraficoRisco) {
        meuGraficoRisco.destroy();
    }

    if (totalRisco > 0) {
        meuGraficoRisco = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Clientes Ativos',
                    data: dados,
                    backgroundColor: [
                        'rgba(46, 204, 113, 0.7)', 
                        'rgba(241, 196, 15, 0.7)', 
                        'rgba(231, 76, 60, 0.7)'   
                    ],
                    borderColor: [
                        'rgba(46, 204, 113, 1)',
                        'rgba(241, 196, 15, 1)',
                        'rgba(231, 76, 60, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Nº de Clientes'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Clientes Ativos por Nível de Risco de Churn'
                    }
                }
            }
        });
    }
}


function calcularEExibirDashboard() {
    const dados = coletarDadosClientes();
    const resultados = calcularIndicadores(dados);
    exibirDashboard(resultados, dados); 
}

// ----------------------------------------------------------------------
// Execução Inicial
// ----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. Carrega dados salvos (motivos e clientes)
    renderMotivosList();
    carregarDadosEAtualizarTabela();
    
    // 2. Garante que os dropdowns e listeners estão configurados
    // (O carregarDadosEAtualizarTabela já chama inicializarMotivosDropdowns para cada linha)
    
    // 3. Calcula e exibe o dashboard com os dados carregados
    calcularEExibirDashboard();
});
