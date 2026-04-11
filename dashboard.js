import { getFirestore, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * Função principal que busca dados e renderiza o gráfico
 * @param {Object} db - Instância do Firestore
 * @param {string} userUid - UID do usuário logado
 */
export async function inicializarDashboard(db, userUid) {
    if (!userUid) return;

    try {
        // 1. BUSCAR TRANSAÇÕES (Últimas 20 para o gráfico não ficar poluído)
        const transacoesRef = collection(db, "transacoes");
        const q = query(
            transacoesRef, 
            where("userId", "==", userUid),
            orderBy("data", "asc"),
            limit(20)
        );

        const querySnapshot = await getDocs(q);
        
        let entradas = [];
        let saidas = [];
        let totalEntrou = 0;
        let totalSaiu = 0;
        querySnapshot.forEach((doc) => {
            const dados = doc.data();
            const valor = parseFloat(dados.valor) || 0;
            
            // Tratamento blindado para a data
            let dataRaw = dados.data;
            let timestamp;
            
            if (dataRaw) {
                // Se for string YYYY-MM-DD, adiciona o horário para não dar erro
                if (typeof dataRaw === 'string' && dataRaw.length === 10) {
                    timestamp = new Date(dataRaw + "T12:00:00").getTime();
                } else {
                    timestamp = new Date(dataRaw).getTime();
                }
            } else {
                timestamp = Date.now();
            }

            const info = dados.descricao || (dados.tipo === 'entrada' ? 'Pix Recebido' : 'Pagamento');

            if (dados.tipo === 'entrada') {
                totalEntrou += valor;
                entradas.push({ x: timestamp, y: valor, info: info });
            } else {
                totalSaiu += valor;
                saidas.push({ x: timestamp, y: valor, info: info });
            }
        });
        

        // 2. ATUALIZAR OS TEXTOS DE VALORES (RESUMO)
        const lucro = totalEntrou - totalSaiu;
        document.getElementById('resumo-entrada').innerText = totalEntrou.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('resumo-saida').innerText = totalSaiu.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('resumo-lucro').innerText = lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('resumo-lucro').style.color = lucro >= 0 ? '#22c55e' : '#ef4444';

        // 3. CONFIGURAÇÃO DO GRÁFICO (APEXCHARTS)
        const options = {
            series: [
                { name: 'Entrou', data: entradas },
                { name: 'Saiu', data: saidas }
            ],
            chart: {
                type: 'area',
                height: 200,
                toolbar: { show: false },
                zoom: { enabled: false },
                animations: { enabled: true, speed: 800 },
                background: 'transparent'
            },
            colors: ['#3B82F6', '#FBBF24'], // Azul para entrada, Amarelo para saída (igual seu SVG)
            fill: {
                type: 'gradient',
                gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 }
            },
            stroke: { curve: 'smooth', width: 3 },
            dataLabels: { enabled: false },
            grid: { show: false },
            xaxis: {
                type: 'datetime',
                labels: { show: false },
                axisBorder: { show: false },
                axisTicks: { show: false }
            },
            yaxis: { show: false },
            legend: { show: false },
            tooltip: {
                theme: 'dark',
                x: { format: 'dd MMM, HH:mm' },
                y: {
                    formatter: function(val, { series, seriesIndex, dataPointIndex, w }) {
                        // Busca a descrição extra que salvamos no objeto
                        const item = w.config.series[seriesIndex].data[dataPointIndex];
                        return `R$ ${val.toFixed(2)} - ${item.info}`;
                    }
                }
            }
        };

        // Renderiza o gráfico na div #mainChart
        const chartElement = document.querySelector("#mainChart");
        if (chartElement) {
            chartElement.innerHTML = ''; // Limpa antes de renderizar
            const chart = new ApexCharts(chartElement, options);
            chart.render();
        }

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
          }

