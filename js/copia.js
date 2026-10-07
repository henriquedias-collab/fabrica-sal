// Cópia de segurança: exporta todos os dados para um arquivo e restaura a partir dele.
// O arquivo é um texto (JSON) com todas as lojas do banco. Fotos já são texto (data:...);
// áudios (Blob) viram texto na exportação e voltam a ser Blob na importação.
// A extensão é .txt porque o Chrome do Android só deixa compartilhar alguns tipos de arquivo, e .json não está entre eles.
window.App = window.App || {};

(function () {
  const A = App;
  const U = () => App.ui;
  const esc = (s) => U().esc(s);
  const ic = (n, t, w) => U().ic(n, t, w);

  const MARCA = 'fabrica-sal-copia';
  const FORMATO = 1;
  const DIAS_AVISO = 7; // cópia mais velha que isso fica laranja
  // Valores de config que são deste celular e não vão na cópia (nem são trocados ao restaurar)
  const CONFIG_DO_CELULAR = ['senhaDono', 'pessoaAtual', 'ultimaCopia'];
  const CONTAGEM = [
    ['misturas', 'misturas'], ['entradas', 'chegadas de insumo'], ['problemas', 'problemas'],
    ['insumos', 'insumos'], ['formulas', 'fórmulas'], ['pastos', 'pastos'], ['pessoas', 'pessoas'],
  ];

  // ---------- montar e ler o arquivo ----------

  function blobParaTexto(b) {
    return new Promise((ok, erro) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => erro(r.error);
      r.readAsDataURL(b);
    });
  }

  function textoParaBlob(dataUrl) {
    const [cab, dados] = dataUrl.split(',');
    const tipo = (cab.match(/^data:([^;]*)/) || [])[1] || '';
    const bin = atob(dados);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: tipo });
  }

  // Troca cada Blob (áudio) por { __blob: "data:..." }, em qualquer lugar do registro
  async function codificar(v) {
    if (v instanceof Blob) return { __blob: await blobParaTexto(v) };
    if (Array.isArray(v)) return Promise.all(v.map(codificar));
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) o[k] = await codificar(v[k]);
      return o;
    }
    return v;
  }

  function decodificar(v) {
    if (Array.isArray(v)) return v.map(decodificar);
    if (v && typeof v === 'object') {
      if (typeof v.__blob === 'string') return textoParaBlob(v.__blob);
      const o = {};
      for (const k of Object.keys(v)) o[k] = decodificar(v[k]);
      return o;
    }
    return v;
  }

  async function montar() {
    const criadaEm = new Date().toISOString();
    const lojas = {};
    for (const n of A.db.LOJAS) lojas[n] = await codificar(await A.db.todos(n));
    const config = (await A.db.todos('config')).filter((c) => !CONFIG_DO_CELULAR.includes(c.chave));
    const texto = JSON.stringify({ app: MARCA, formato: FORMATO, criadaEm, lojas, config });
    const d = new Date(criadaEm);
    const p = (n) => String(n).padStart(2, '0');
    const nome = `cocho-copia-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}h${p(d.getMinutes())}.txt`;
    return { criadaEm, lojas, arquivo: new File([texto], nome, { type: 'text/plain' }) };
  }

  // Lê e confere o arquivo escolhido. Dá erro com mensagem simples se não for uma cópia do app.
  async function ler(arquivo) {
    let dados;
    try {
      dados = JSON.parse(await arquivo.text());
    } catch (e) {
      throw new Error('Esse arquivo não é uma cópia do app.');
    }
    if (!dados || dados.app !== MARCA || !dados.lojas || typeof dados.lojas !== 'object') {
      throw new Error('Esse arquivo não é uma cópia do app.');
    }
    if (dados.formato > FORMATO) throw new Error('Essa cópia é de uma versão mais nova do app. Atualize o app e tente de novo.');
    const lojas = {};
    for (const n of A.db.LOJAS) {
      const lista = dados.lojas[n] || [];
      if (!Array.isArray(lista) || lista.some((x) => !x || typeof x.id !== 'string')) {
        throw new Error('A cópia está com defeito (' + n + '). Nada foi mudado.');
      }
      lojas[n] = lista;
    }
    const config = (Array.isArray(dados.config) ? dados.config : [])
      .filter((c) => c && typeof c.chave === 'string' && !CONFIG_DO_CELULAR.includes(c.chave));
    return { criadaEm: dados.criadaEm, lojas, config, nomeArquivo: arquivo.name };
  }

  // Substitui TUDO pelo conteúdo da cópia, numa transação só: ou troca tudo, ou nada.
  async function restaurar(copia) {
    const lojas = {};
    for (const n of A.db.LOJAS) lojas[n] = copia.lojas[n].map(decodificar); // antes da transação (ela não pode esperar)
    const configAtual = await A.db.todos('config');
    await A.db.transacao(A.db.LOJAS.concat('config'), (l) => {
      A.db.LOJAS.forEach((n) => {
        l(n).clear();
        lojas[n].forEach((x) => l(n).put(x));
      });
      configAtual.filter((c) => !CONFIG_DO_CELULAR.includes(c.chave)).forEach((c) => l('config').delete(c.chave));
      copia.config.forEach((c) => l('config').put(c));
    });
    // A data da cópia restaurada conta como a última cópia: esses dados estão guardados nela
    if (copia.criadaEm) await A.db.definir('ultimaCopia', copia.criadaEm);
    // Quem estava usando o app pode não existir na cópia
    const atual = await A.db.config('pessoaAtual');
    const p = atual ? await A.db.pegar('pessoas', atual) : null;
    if (!p || p.ativo === false) {
      A.estado.pessoa = null;
      if (atual) await A.db.apagar('config', 'pessoaAtual');
    } else {
      A.estado.pessoa = p;
    }
    A.estado.mistura = null;
    await A.calc.converterPrecosParaKg(); // cópia antiga: preço por saco -> R$/kg
  }

  // ---------- textos ----------

  function dataHora(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${d.getHours()}h${p(d.getMinutes())}`;
  }

  function haQuanto(iso) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dia = new Date(iso);
    dia.setHours(0, 0, 0, 0);
    const dias = Math.round((hoje - dia) / A.calc.DIA);
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    return `há ${dias} dias`;
  }

  function resumo(lojas) {
    return CONTAGEM.map(([n, nome]) => `${(lojas[n] || []).length} ${nome}`).join(' · ');
  }

  function tamanho(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return String(Math.round(bytes / 1024 / 1024 * 10) / 10).replace('.', ',') + ' MB';
  }

  // Aviso do topo da Área do dono: verde até 7 dias, laranja depois (ou se nunca fez)
  A.copia = {
    async aviso() {
      const ultima = await A.db.config('ultimaCopia');
      const dias = ultima ? (Date.now() - new Date(ultima).getTime()) / A.calc.DIA : Infinity;
      if (!ultima) {
        return `<div class="alerta laranja" role="status">${ic('atencao', 40, 2.4)}<div>
          <b>Nenhuma cópia feita</b><span>Exporte uma cópia e guarde no Google Drive.</span></div></div>`;
      }
      const texto = `Última cópia: ${dataHora(ultima)} (${haQuanto(ultima)})`;
      if (dias > DIAS_AVISO) {
        return `<div class="alerta laranja" role="status">${ic('atencao', 40, 2.4)}<div>
          <b>Faça uma cópia nova</b><span>${esc(texto)}</span></div></div>`;
      }
      return `<div class="alerta verde" role="status">${ic('certo', 40, 3)}<div>
        <b>Cópia em dia</b><span>${esc(texto)}</span></div></div>`;
    },

    // Botão IMPORTAR: escolhe o arquivo e leva para a tela de confirmação
    escolherArquivo() {
      const entrada = document.createElement('input');
      entrada.type = 'file';
      entrada.accept = '.txt,.json,text/plain,application/json';
      entrada.addEventListener('change', async () => {
        const f = entrada.files && entrada.files[0];
        if (!f) return;
        try {
          const copia = await ler(f);
          await A.ir('importarCopia', { copia });
        } catch (e) {
          console.error(e);
          A.mostrarAviso(e.message || 'Não deu para ler esse arquivo', 'laranja');
        }
      });
      entrada.click();
    },
  };

  // ---------- telas ----------

  Object.assign(A.telas, {
    // EXPORTAR: monta o arquivo e mostra os botões para guardar
    async exportarCopia() {
      const { lojas, arquivo } = await montar();
      const celular = matchMedia('(pointer: coarse)').matches;
      const podeEnviar = !!(navigator.canShare && navigator.canShare({ files: [arquivo] }));
      const enviarPrimeiro = celular && podeEnviar;
      return {
        fala: enviarPrimeiro
          ? 'Cópia pronta. Toque em guardar no Drive e escolha o Google Drive.'
          : 'Cópia pronta. Toque em baixar arquivo e guarde no Google Drive.',
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">EXPORTAR CÓPIA</h1>${U().btnFalar()}</div>
  <section class="secao">
    <h2>Cópia pronta</h2>
    <p>${esc(resumo(lojas))}</p>
    <p>Fotos e áudios vão junto. Tamanho: ${tamanho(arquivo.size)}.</p>
    <p class="ajuda">${esc(arquivo.name)}</p>
  </section>
  ${enviarPrimeiro ? `
  <button class="btn verde grande" data-acao="enviar">${ic('nuvem', 44, 2.4)} GUARDAR NO DRIVE</button>
  <p class="ajuda centro">Na lista que abrir, escolha <b>Drive</b> (ou "Salvar em Arquivos" no iPhone).</p>
  <button class="btn" data-acao="baixar">${ic('baixar', 30, 2.4)} Baixar arquivo no celular</button>` : `
  <button class="btn verde grande" data-acao="baixar">${ic('baixar', 44, 2.4)} BAIXAR ARQUIVO</button>
  <p class="ajuda centro">Depois, coloque o arquivo numa pasta do Google Drive.</p>
  ${podeEnviar ? `<button class="btn" data-acao="enviar">${ic('nuvem', 30, 2.4)} Compartilhar</button>` : ''}`}
</main>`,
        ligar(r) {
          const feito = async (msg) => {
            await A.db.definir('ultimaCopia', new Date().toISOString());
            await A.ir('dono');
            A.mostrarAviso(msg);
          };
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=enviar]', async () => {
            try {
              await navigator.share({ files: [arquivo], title: 'Cópia do app Cocho' });
              await feito('Cópia guardada. Confira se apareceu no Drive.');
            } catch (e) {
              if (e && e.name === 'AbortError') return; // a pessoa fechou a lista sem escolher
              console.error(e);
              A.mostrarAviso('Não deu para enviar. Use "Baixar arquivo".', 'laranja');
            }
          });
          U().ao(r, '[data-acao=baixar]', async () => {
            const url = URL.createObjectURL(arquivo);
            const a = document.createElement('a');
            a.href = url;
            a.download = arquivo.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            await feito('Arquivo baixado. Guarde no Google Drive.');
          });
        },
      };
    },

    // IMPORTAR: mostra o que tem na cópia e o que vai ser substituído, e pede confirmação
    async importarCopia({ copia }) {
      if (!copia) return A.telas.dono();
      const aqui = {};
      for (const [n] of CONTAGEM) aqui[n] = await A.db.todos(n);
      return {
        fala: 'Atenção. Restaurar a cópia apaga tudo o que está neste celular agora e coloca o que está na cópia.',
        html: `
<main class="tela">
  <div class="topo">${U().btnVoltar()}<h1 class="titulo">IMPORTAR CÓPIA</h1>${U().btnFalar()}</div>
  <section class="secao">
    <h2>Na cópia${copia.criadaEm ? ' de ' + esc(dataHora(copia.criadaEm)) : ''}</h2>
    <p>${esc(resumo(copia.lojas))}</p>
    <p class="ajuda">${esc(copia.nomeArquivo || '')}</p>
  </section>
  <div class="alerta vermelho" role="alert">${ic('atencao', 40, 2.4)}<div>
    <b>Vai substituir tudo</b><span>O que está neste celular agora some: ${esc(resumo(aqui))}.</span></div></div>
  <p class="ajuda">A senha da Área do dono continua a mesma deste celular.</p>
  <button class="btn vermelho grande" data-acao="restaurar">${ic('desfazer', 40, 2.6)} SUBSTITUIR</button>
  <button class="btn" data-acao="cancelar">Cancelar</button>
</main>`,
        ligar(r) {
          U().ao(r, '[data-acao=voltar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=cancelar]', () => A.ir('dono'));
          U().ao(r, '[data-acao=restaurar]', async (b) => {
            b.disabled = true;
            try {
              await restaurar(copia);
              await A.ir('dono');
              A.mostrarAviso('Cópia restaurada');
            } catch (e) {
              console.error(e);
              b.disabled = false;
              A.mostrarAviso('Não deu para restaurar. Nada foi mudado.', 'laranja');
            }
          });
        },
      };
    },
  });
})();
