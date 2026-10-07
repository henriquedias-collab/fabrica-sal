// RELATÓRIOS EM PDF PARA LER (várias páginas), com as peças de pdf.js (App.pdf.Relatorio) e o visual Cocho.
// "PDF PARA LER" da tela EXPORTAR CÓPIA: tudo o que está no celular, para gente ler.
// A cópia de segurança continua sendo o arquivo .cocho (dados); este PDF não serve para restaurar.
window.App = window.App || {};

(function () {
  const A = App;
  const C = () => App.calc;
  const P = () => App.pdf;

  const ddmm = (iso) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const ddmmaa = (iso) => `${ddmm(iso)}/${String(new Date(iso).getFullYear()).slice(2)}`;
  const hora = (iso) => { const d = new Date(iso); return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`; };
  const recentes = (lista, campo) => lista.slice().sort((a, b) => String(b[campo]).localeCompare(String(a[campo])));

  // Foto pequena para o PDF (JPEG quadrado, leve): o PDF fica pequeno mesmo com muitas fotos
  function miniatura(dataUrl, lado) {
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        const menor = Math.min(img.naturalWidth, img.naturalHeight);
        const c = document.createElement('canvas');
        c.width = lado; c.height = lado;
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, lado, lado);
        g.drawImage(img, (img.naturalWidth - menor) / 2, (img.naturalHeight - menor) / 2, menor, menor, 0, 0, lado, lado);
        ok(c.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => ok(null);
      img.src = dataUrl;
    });
  }

  const MAX_LINHAS = 40; // últimas misturas, chegadas e problemas

  // RELATÓRIO COMPLETO: fazenda, data, insumos e estoque, fórmulas, lotes, últimas misturas, chegadas e problemas (com fotos)
  async function completo() {
    const P_ = P();
    const { num, reais, kg, COR } = P_;
    const [jsPDF, png, insumos, formulas, pastos, misturas, entradas, problemas, nomeFazenda, epoca] = await Promise.all([
      P_.carregar(), P_.logo(), A.db.todos('insumos'), A.db.todos('formulas'), A.db.todos('pastos'), A.db.todos('misturas'),
      A.db.todos('entradas'), A.db.todos('problemas'), A.db.config('nomeFazenda'), A.db.config('epocaAtual'),
    ]);
    const agora = Date.now();
    const insPorId = {};
    insumos.forEach((i) => { insPorId[i.id] = i; });
    const forPorId = {};
    formulas.forEach((f) => { forPorId[f.id] = f; });
    const rel = new P_.Relatorio(jsPDF, { paginas: true });
    const hoje = new Date(agora).toISOString();
    rel.cabecalho('Relatório completo', `${nomeFazenda || 'Fazenda'} · ${ddmm(hoje)}/${new Date(agora).getFullYear()} às ${hora(hoje)}`, png);

    const abertos = problemas.filter((p) => !p.resolvidoEm).length;
    rel.numeros([
      { rotulo: 'Insumos', valor: String(insumos.length), detalhe: 'cadastrados' },
      { rotulo: 'Fórmulas', valor: String(formulas.length), detalhe: 'sais cadastrados' },
      { rotulo: 'Lotes', valor: String(pastos.length), detalhe: `${num(pastos.reduce((s, p) => s + (p.cabecas || 0), 0))} cabeças` },
      { rotulo: 'Misturas', valor: String(misturas.length), detalhe: 'registradas no celular' },
      { rotulo: 'Problemas', valor: String(problemas.length), detalhe: `${abertos} ${abertos === 1 ? 'aberto' : 'abertos'}`, destaque: abertos > 0 },
    ]);
    if (epoca) rel.frase(`Época marcada: ${C().EPOCAS[epoca].nome.toLowerCase()}.`, { b: true, cor: COR.tinta });
    rel.y += 2;

    const cab = (cols) => rel.linha(cols.map((c) => Object.assign({}, c, { cor: COR.tinta2, b: true })), { tam: 8, alt: 6 });

    // INSUMOS E ESTOQUE
    if (rel.secao('Insumos e estoque', 'estoque estimado pelo app · dias = no ritmo dos últimos 14 dias')) {
      const colunas = () => cab([{ t: 'Insumo', w: 0.27 }, { t: 'Estoque', w: 0.13, al: 'right' }, { t: 'Em sacos', w: 0.17, al: 'right' }, { t: 'Mínimo', w: 0.11, al: 'right' }, { t: 'R$/kg', w: 0.1, al: 'right' }, { t: 'Situação', w: 0.22, al: 'right' }]);
      colunas();
      C().situacaoEstoque(insumos, misturas, agora).sort((a, b) => a.insumo.nome.localeCompare(b.insumo.nome, 'pt-BR')).forEach((s) => {
        const i = s.insumo;
        const pk = C().precoKg(i);
        const sit = i.estoqueKg <= 0 ? 'ACABOU' : s.dias !== null ? `${s.dias} ${s.dias === 1 ? 'DIA' : 'DIAS'}` : (s.nivel ? 'ABAIXO DO MÍNIMO' : 'SEM CONSUMO');
        rel.linha([
          { t: i.nome, w: 0.27, b: true, quebra: true },
          { t: kg(Math.max(0, i.estoqueKg)), w: 0.13, al: 'right' },
          { t: C().unidade(i).kgPor ? C().qtdTexto(i.estoqueKg, i) : 'a granel', w: 0.17, al: 'right', cor: COR.tinta2, tam: 9.5 },
          { t: i.estoqueMinimoKg > 0 ? kg(i.estoqueMinimoKg) : '-', w: 0.11, al: 'right', cor: COR.tinta2 },
          { t: pk !== null ? reais(pk, 2) : null, w: 0.1, al: 'right' },
          { t: sit, w: 0.22, al: 'right', selo: s.nivel || (s.dias !== null ? 'verde' : 'sem') },
        ], { alt: i.nome.length > 22 ? 11 : 8.5 });
      });
      if (!insumos.length) rel.frase('Nenhum insumo cadastrado.');
      rel.y += 3;
    }

    // FÓRMULAS: receita da batida base, % de cada insumo e custo por kg
    if (rel.secao('Fórmulas', 'receita da batida base · custo pelos preços de hoje')) {
      formulas.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach((f) => {
        const base = C().baseKg(f);
        const c = C().custoItens(f.itens, insPorId);
        const tipo = C().TIPOS[f.tipo] ? C().TIPOS[f.tipo].nome.toLowerCase() : 'sem tipo';
        const ep = C().EPOCAS[C().epocaDaFormula(f)].nome.toLowerCase();
        rel.cabe(8.5 + 6 * Math.min(f.itens.length, 3)); // nome da fórmula junto das primeiras linhas
        rel.linha([
          { t: f.nome, w: 0.4, b: true },
          { t: `${tipo} · ${ep}`, w: 0.24, cor: COR.tinta2, tam: 9.5 },
          { t: `batida ${C().tamanhos(f).map((t) => num(t)).join(' / ')} kg`, w: 0.2, al: 'right', tam: 9.5 },
          { t: c.porKg !== null ? reais(c.porKg, 2) + '/kg' : null, w: 0.16, al: 'right', b: true },
        ], { fundo: COR.creme });
        f.itens.forEach((it) => {
          const ins = insPorId[it.insumoId];
          rel.linha([
            { t: '', w: 0.04 },
            { t: ins ? ins.nome : '(insumo apagado)', w: 0.46 },
            { t: kg(it.kg), w: 0.2, al: 'right' },
            { t: base > 0 ? num((it.kg / base) * 100) + '%' : '-', w: 0.15, al: 'right', cor: COR.tinta2 },
            { t: ins && ins.maxPct > 0 ? `máx. ${num(ins.maxPct)}%` : '', w: 0.15, al: 'right', cor: COR.tinta2, tam: 8.5 },
          ], { tam: 9.5, alt: 6 });
        });
        rel.y += 1.5;
      });
      if (!formulas.length) rel.frase('Nenhuma fórmula cadastrada.');
      rel.y += 2;
    }

    // LOTES
    if (rel.secao('Lotes', 'sal de cada época · meta do técnico águas / seca (g/cabeça/dia)')) {
      cab([{ t: 'Lote', w: 0.3 }, { t: 'Cabeças', w: 0.09, al: 'right' }, { t: '', w: 0.02 }, { t: 'Sal das águas', w: 0.23 }, { t: 'Sal da seca', w: 0.23 }, { t: 'Meta (g)', w: 0.13, al: 'right' }]);
      const nomeSal = (id) => (id ? (forPorId[id] ? forPorId[id].nome : '(apagada)') : '-');
      pastos.slice().sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0)).forEach((p) => {
        const meta = (g) => (g > 0 ? num(g) : '-');
        rel.linha([
          { t: `${p.numero ?? ''} · ${p.nome}`, w: 0.3, b: true },
          { t: num(p.cabecas || 0), w: 0.09, al: 'right' }, { t: '', w: 0.02 },
          { t: nomeSal(p.formulaAguasId), w: 0.23, tam: 9.5 },
          { t: nomeSal(p.formulaSecaId), w: 0.23, tam: 9.5 },
          { t: `${meta(p.metaAguasG)} / ${meta(p.metaSecaG)}`, w: 0.13, al: 'right' },
        ]);
      });
      if (!pastos.length) rel.frase('Nenhum lote cadastrado.');
      rel.y += 3;
    }

    // ÚLTIMAS MISTURAS
    const ms = recentes(misturas, 'fim');
    if (rel.secao('Últimas misturas', `${Math.min(ms.length, MAX_LINHAS)} de ${ms.length}`)) {
      cab([{ t: 'Data', w: 0.14 }, { t: 'Sal', w: 0.27 }, { t: 'Kg', w: 0.11, al: 'right' }, { t: '', w: 0.02 }, { t: 'Destino', w: 0.26 }, { t: 'Quem fez', w: 0.2 }]);
      ms.slice(0, MAX_LINHAS).forEach((m) => {
        const d = m.destino;
        const destino = !d || d.tipo === 'nenhum' ? 'sem destino' : d.tipo === 'deposito' ? 'Depósito' : `Pasto ${d.numero} · ${d.nome}`;
        rel.linha([
          { t: `${ddmmaa(m.fim)} ${hora(m.fim)}`, w: 0.14, cor: COR.tinta2, tam: 9 },
          { t: m.formulaNome + (m.status === 'incompleta' ? ' (incompleta)' : ''), w: 0.27, b: true, tam: 10 },
          { t: kg(m.totalKg), w: 0.11, al: 'right' }, { t: '', w: 0.02 },
          { t: destino + (d && d.foraDoPlano ? ' (fora do plano)' : ''), w: 0.26, tam: 9.5 },
          { t: m.pessoaNome || '-', w: 0.2, cor: COR.tinta2, tam: 9.5 },
        ]);
      });
      if (!ms.length) rel.frase('Nenhuma mistura registrada.');
      rel.y += 3;
    }

    // CHEGADAS DE INSUMO
    const es = recentes(entradas, 'quando');
    if (rel.secao('Chegadas de insumo', `${Math.min(es.length, MAX_LINHAS)} de ${es.length}`)) {
      cab([{ t: 'Data', w: 0.14 }, { t: 'Insumo', w: 0.32 }, { t: 'Quanto', w: 0.34 }, { t: 'Recebido por', w: 0.2 }]);
      es.slice(0, MAX_LINHAS).forEach((e) => {
        rel.linha([
          { t: `${ddmmaa(e.quando)} ${hora(e.quando)}`, w: 0.14, cor: COR.tinta2, tam: 9 },
          { t: e.insumoNome, w: 0.32, b: true, tam: 10 },
          { t: e.texto, w: 0.34, tam: 9.5 },
          { t: e.pessoaNome || '-', w: 0.2, cor: COR.tinta2, tam: 9.5 },
        ]);
      });
      if (!es.length) rel.frase('Nenhuma chegada registrada.');
      rel.y += 3;
    }

    // PROBLEMAS (com foto pequena)
    const ps = recentes(problemas, 'quando');
    if (rel.secao('Problemas e avisos', `${Math.min(ps.length, MAX_LINHAS)} de ${ps.length} · ${abertos} ${abertos === 1 ? 'aberto' : 'abertos'}`)) {
      const fotos = await Promise.all(ps.slice(0, MAX_LINHAS).map((p) => (p.foto ? miniatura(p.foto, 160) : null)));
      ps.slice(0, MAX_LINHAS).forEach((p, k) => {
        const desc = A.ui.descreverProblema(p) + (p.perdaKg > 0 ? ` · perdeu ${kg(p.perdaKg)}` : '');
        const alt = fotos[k] ? 18 : desc.length > 42 ? 11 : 8.5;
        rel.cabe(alt); // pode abrir página nova: a foto vai junto da linha
        const y0 = rel.y;
        rel.linha([
          { t: `${ddmmaa(p.quando)} ${hora(p.quando)}`, w: 0.14, cor: COR.tinta2, tam: 9 },
          { t: desc, w: 0.42, b: true, tam: 9.5, quebra: true },
          { t: p.pessoaNome || '-', w: 0.14, cor: COR.tinta2, tam: 9.5 },
          p.resolvidoEm ? { t: 'RESOLVIDO', w: 0.15, selo: 'verde', al: 'center' } : { t: 'ABERTO', w: 0.15, selo: 'vermelho', al: 'center' },
          { t: '', w: 0.15 },
        ], { alt });
        if (fotos[k]) rel.imagem(fotos[k], rel.L - rel.m - 16, y0 + 0.5, 16, 16);
      });
      if (!ps.length) rel.frase('Nenhum problema registrado.', { cor: COR.verdeEscuro, b: true });
    }

    rel.rodapeTodas(`Gerado pelo Cocho em ${P_.dataHora(agora)}. PDF só para ler: a cópia de segurança é o arquivo .cocho. "sem dado" = falta preço ou informação.`);
    const d = new Date(agora);
    const data = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    return { blob: rel.blob(), nome: P_.nomeArquivo('Relatório completo', data, nomeFazenda) };
  }

  A.pdfRelatorios = { completo, miniatura };
})();
