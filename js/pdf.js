// RELATÓRIOS EM PDF — gerados no próprio celular, sem internet.
// Usa a biblioteca jsPDF (js/vendor/jspdf.umd.min.js, licença MIT), guardada no app e carregada só quando precisa.
// As peças (cabeçalho, números grandes, seção, linha de tabela) servem para todos os relatórios, com o visual Cocho.
// A cópia de segurança NÃO é PDF: continua no formato de dados que o IMPORTAR CÓPIA lê.
window.App = window.App || {};

(function () {
  const A = App;
  const C = () => App.calc;

  // Cores do Cocho (RGB)
  const COR = {
    terra: [166, 83, 0], terraEscura: [122, 61, 0], creme: [247, 240, 228], cremeEscuro: [244, 227, 200], borda: [234, 217, 192],
    tinta: [43, 29, 16], tinta2: [107, 84, 64], branco: [255, 255, 255],
    verde: [46, 125, 74], verdeClaro: [220, 239, 226], verdeEscuro: [31, 90, 52],
    amarelo: [217, 154, 0], amareloClaro: [253, 240, 207], amareloTexto: [107, 74, 0],
    vermelho: [179, 38, 30], vermelhoClaro: [249, 222, 220], vermelhoTexto: [140, 29, 23], cinza: [236, 227, 211],
  };
  const NIVEL_COR = {
    verde: [COR.verdeClaro, COR.verdeEscuro, COR.verde], laranja: [COR.amareloClaro, COR.amareloTexto, COR.amarelo],
    vermelho: [COR.vermelhoClaro, COR.vermelhoTexto, COR.vermelho], sem: [COR.cinza, COR.tinta2, COR.borda],
  };

  // ---------- carregar a biblioteca e o logo (tudo do próprio app, funciona offline) ----------
  let jsPdfPromessa = null;
  function carregar() {
    if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
    if (!jsPdfPromessa) {
      jsPdfPromessa = new Promise((ok, erro) => {
        const s = document.createElement('script');
        s.src = 'js/vendor/jspdf.umd.min.js';
        s.onload = () => ok(window.jspdf.jsPDF);
        s.onerror = () => { jsPdfPromessa = null; erro(new Error('Não deu para abrir o gerador de PDF.')); };
        document.head.appendChild(s);
      });
    }
    return jsPdfPromessa;
  }
  let logoCache = null;
  function logo() {
    if (logoCache) return Promise.resolve(logoCache);
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 192; c.height = 192;
        c.getContext('2d').drawImage(img, 0, 0, 192, 192);
        logoCache = c.toDataURL('image/png');
        ok(logoCache);
      };
      img.onerror = () => ok(null); // sem logo o PDF sai assim mesmo
      img.src = 'icones/icone-192.png';
    });
  }

  // A fonte padrão do PDF (Helvetica) só tem os caracteres do português "de sempre": troca o resto
  function texto(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[▲]/g, '+').replace(/[▼]/g, '-').replace(/[−–—]/g, '-').replace(/→/g, '->').replace(/≈/g, '~')
      .replace(/[^\x00-\xFF€…]/g, '');
  }
  const num = (x, casas) => Number(x).toLocaleString('pt-BR', { minimumFractionDigits: casas || 0, maximumFractionDigits: casas === undefined ? 1 : casas });
  const reais = (v, casas) => (v === null || v === undefined ? null : 'R$ ' + num(v, casas === undefined ? 2 : casas));
  const kg = (v) => (v === null || v === undefined ? null : num(v) + ' kg');
  const SEM = 'sem dado';

  // Nome de arquivo claro: "Cocho - Fazenda Exemplo - Resumo 28-09 a 04-10.pdf"
  function nomeArquivo(tipo, rotulo, fazenda) {
    const limpo = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    return ['Cocho', fazenda ? limpo(fazenda) : null, `${limpo(tipo)}${rotulo ? ' ' + limpo(rotulo).replace(/\//g, '-') : ''}`]
      .filter(Boolean).join(' - ') + '.pdf';
  }

  // ---------- montador de relatório (A4 em pé, mm) ----------
  // Uma página só (resumo): o que não cabe fica de fora. Com { paginas: true }: abre página nova quando acaba o espaço.
  class Relatorio {
    constructor(jsPDF, op) {
      this.multi = !!(op && op.paginas);
      this.doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      this.L = 210; this.H = 297; this.m = 12; this.w = this.L - 2 * this.m; this.y = this.m;
      this.doc.setFont('helvetica', 'normal');
    }
    cor(c, tipo) { const d = this.doc; if (tipo === 'fill') d.setFillColor(...c); else if (tipo === 'draw') d.setDrawColor(...c); else d.setTextColor(...c); }
    fonte(tam, negrito) { this.doc.setFont('helvetica', negrito ? 'bold' : 'normal'); this.doc.setFontSize(tam); }
    txt(s, x, y, op) { this.doc.text(texto(s), x, y, op || {}); }
    largura(s) { return this.doc.getTextWidth(texto(s)); }
    // Texto que não cabe na coluna termina em "..." (em vez de invadir a linha de baixo)
    cortar(s, max) {
      let t = texto(s);
      if (this.doc.getTextWidth(t) <= max) return t;
      while (t.length > 1 && this.doc.getTextWidth(t + '...') > max) t = t.slice(0, -1);
      return t.trimEnd() + '...';
    }
    cabe(alt) { // deixa espaço para o rodapé
      if (this.y + alt <= this.H - 16) return true;
      if (!this.multi) return false;
      this.novaPagina();
      return true;
    }
    // Página seguinte: faixa terra fina com o título, para não perder o fio
    novaPagina() {
      const d = this.doc;
      d.addPage();
      this.cor(COR.terra, 'fill'); d.rect(0, 0, this.L, 9, 'F');
      this.cor(COR.branco); this.fonte(9, true); this.txt(this.titulo || '', this.m, 6);
      this.fonte(9, false); this.txt(this.subtitulo || '', this.L - this.m, 6, { align: 'right' });
      this.y = 15;
    }
    // Foto pequena (data:image/jpeg); se der erro, segue sem ela
    imagem(dataUrl, x, y, w, h) {
      try { this.doc.addImage(dataUrl, 'JPEG', x, y, w, h); } catch (e) { console.warn('foto no PDF:', e); }
    }

    // Faixa terra com logo, título, nome da fazenda e período
    cabecalho(titulo, subtitulo, logoPng) {
      const d = this.doc;
      this.titulo = titulo; this.subtitulo = subtitulo;
      this.cor(COR.terra, 'fill'); d.rect(0, 0, this.L, 30, 'F');
      this.cor(COR.terraEscura, 'fill'); d.rect(0, 30, this.L, 1.6, 'F');
      let x = this.m;
      if (logoPng) {
        // fundo creme atrás do logo, para ele aparecer sobre a faixa terra
        this.cor(COR.creme, 'fill'); d.roundedRect(x - 1.2, 4.8, 20.4, 20.4, 4, 4, 'F');
        d.addImage(logoPng, 'PNG', x, 6, 18, 18); x += 24;
      }
      this.cor(COR.branco); this.fonte(20, true); this.txt(titulo, x, 15);
      this.fonte(11, false); this.txt(subtitulo, x, 22.5);
      this.fonte(9, true); this.txt('COCHO', this.L - this.m, 12, { align: 'right' });
      this.y = 38;
    }

    // Números grandes lado a lado: [{ rotulo, valor (texto ou null = sem dado), detalhe, destaque }]
    numeros(lista) {
      const d = this.doc;
      const gap = 3;
      const lw = (this.w - gap * (lista.length - 1)) / lista.length;
      const alt = 25;
      lista.forEach((k, i) => {
        const x = this.m + i * (lw + gap);
        if (k.destaque) { this.cor(COR.terra, 'fill'); d.roundedRect(x, this.y, lw, alt, 3, 3, 'F'); }
        else { this.cor(COR.creme, 'fill'); this.cor(COR.borda, 'draw'); d.setLineWidth(0.6); d.roundedRect(x, this.y, lw, alt, 3, 3, 'FD'); }
        const c1 = k.destaque ? COR.branco : COR.tinta2;
        const c2 = k.destaque ? COR.branco : COR.tinta;
        this.cor(c1); this.fonte(8, true); this.txt(k.rotulo.toUpperCase(), x + 4, this.y + 6);
        if (k.valor === null || k.valor === undefined) { this.cor(c1); this.fonte(14, false); this.txt(SEM, x + 4, this.y + 15); }
        else { this.cor(c2); this.fonte(19, true); this.txt(k.valor, x + 4, this.y + 15.5); }
        if (k.detalhe) { this.cor(c1); this.fonte(8, false); this.txt(this.cortar(k.detalhe, lw - 8), x + 4, this.y + 21.5); }
      });
      this.y += alt + 6;
    }

    secao(titulo, ajuda) {
      if (!this.cabe(this.multi ? 26 : 16)) return false; // em várias páginas: o título não fica sozinho no pé
      this.cor(COR.terraEscura); this.fonte(12.5, true); this.txt(titulo, this.m, this.y + 4);
      if (ajuda) { this.cor(COR.tinta2); this.fonte(8, false); this.txt(ajuda, this.L - this.m, this.y + 4, { align: 'right' }); }
      this.cor(COR.borda, 'draw'); this.doc.setLineWidth(0.5); this.doc.line(this.m, this.y + 6.5, this.L - this.m, this.y + 6.5);
      this.y += 10;
      return true;
    }

    // Linha de tabela: colunas [{ t: texto|null, w: largura em fração, al: 'left'|'right'|'center', b: negrito, selo: nivel, cor }]
    linha(cols, op) {
      const o = op || {};
      const alt = o.alt || 8.5;
      if (!this.cabe(alt)) return false;
      const d = this.doc;
      if (o.fundo) { this.cor(o.fundo, 'fill'); d.rect(this.m, this.y - 1, this.w, alt, 'F'); }
      let x = this.m;
      cols.forEach((c) => {
        const cw = this.w * c.w;
        const tam = c.tam || o.tam || 11;
        const yTxt = this.y + alt / 2 + tam * 0.13;
        if (c.selo) {
          const [fundo, letra, borda] = NIVEL_COR[c.selo] || NIVEL_COR.sem;
          this.fonte(8, true);
          const tw = this.largura(c.t) + 5;
          const sx = c.al === 'right' ? x + cw - tw : c.al === 'center' ? x + (cw - tw) / 2 : x;
          this.cor(fundo, 'fill'); this.cor(borda, 'draw'); d.setLineWidth(0.4);
          const sh = Math.min(alt - 2.6, 5.9); // selo sempre do mesmo tamanho, no meio da linha
          d.roundedRect(sx, this.y + alt / 2 - 0.7 - sh / 2, tw, sh, 1.6, 1.6, 'FD');
          this.cor(letra); this.txt(c.t, sx + 2.5, this.y + alt / 2 + 0.9);
        } else {
          const vazio = c.t === null || c.t === undefined;
          this.fonte(vazio ? tam - 1 : tam, !vazio && (c.b || o.b));
          this.cor(vazio ? COR.tinta2 : (c.cor || o.cor || COR.tinta));
          const s = vazio ? SEM : c.t;
          const ax = c.al === 'right' ? x + cw - 1 : c.al === 'center' ? x + cw / 2 : x + 1;
          if (c.quebra) {
            // até 2 linhas (a linha da tabela precisa ter altura para isso)
            const ls = this.doc.splitTextToSize(texto(s), cw - 2).slice(0, 2);
            const passo = tam * 0.42;
            ls.forEach((l, k) => this.doc.text(l, ax, yTxt + (k - (ls.length - 1) / 2) * passo, { align: c.al || 'left' }));
          } else {
            this.txt(this.cortar(s, cw - 2), ax, yTxt, { align: c.al || 'left' });
          }
        }
        x += cw;
      });
      this.y += alt;
      if (o.traco !== false) { this.cor(COR.cinza, 'draw'); d.setLineWidth(0.25); d.line(this.m, this.y - 0.5, this.L - this.m, this.y - 0.5); }
      return true;
    }

    frase(s, op) {
      const o = op || {};
      if (!this.cabe(6)) return false;
      this.fonte(o.tam || 9, o.b); this.cor(o.cor || COR.tinta2);
      const ls = this.doc.splitTextToSize(texto(s), this.w); // texto longo: várias linhas, sem sobrepor
      ls.forEach((l, k) => { if (k) this.cabe(4.2); this.doc.text(l, this.m, this.y + 3.5 + (k ? 0 : 0)); if (k < ls.length - 1) this.y += 4.2; });
      this.y += o.alt || 6;
      return true;
    }

    rodape(s) {
      this.cor(COR.borda, 'draw'); this.doc.setLineWidth(0.4); this.doc.line(this.m, this.H - 12, this.L - this.m, this.H - 12);
      this.fonte(7.5, false); this.cor(COR.tinta2);
      this.txt(s, this.m, this.H - 7.5, { maxWidth: this.w });
    }

    // Rodapé em todas as páginas, com "página 1 de 3"
    rodapeTodas(s) {
      const n = this.doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        this.doc.setPage(i);
        this.rodape(s);
        this.fonte(7.5, true); this.cor(COR.tinta2);
        this.txt(`página ${i} de ${n}`, this.L - this.m, this.H - 4, { align: 'right' });
      }
    }

    blob() { return this.doc.output('blob'); }
  }

  const dataHora = (ms) => {
    const d = new Date(ms);
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${d.getHours()}h${p(d.getMinutes())}`;
  };

  // ---------- PDF do RESUMO DA SEMANA (uma página) ----------
  async function resumo(r) {
    const [jsPDF, png] = await Promise.all([carregar(), logo()]);
    const rel = new Relatorio(jsPDF);
    const s = r.semana;
    const fimDomingo = new Date(r.periodo.fim - A.resumoCalc.DIA);
    const ano = fimDomingo.getFullYear();
    rel.cabecalho('Resumo da semana', `${r.nomeFazenda || 'Fazenda'} · ${r.periodo.rotulo}/${ano}${r.periodo.emAndamento ? ' (até hoje)' : ''}`, png);

    const p = s.perdas;
    rel.numeros([
      { rotulo: 'Gasto da semana', valor: reais(s.gasto, 0), detalhe: `${s.misturas} misturas · ${kg(s.kgFeitos)} de sal${s.gastoEstimado ? ' · ESTIMADO' : ''}`, destaque: true },
      { rotulo: 'Custo por cabeça/dia', valor: reais(s.custoCabDia, 2), detalhe: 'média dos lotes com sal', destaque: true },
      { rotulo: 'Perdas', valor: p.reais === null ? null : reais(p.reais, 0), detalhe: `${p.quantidade} ${p.quantidade === 1 ? 'problema' : 'problemas'} · ${p.kg === null ? 'kg ' + SEM : kg(p.kg)}` },
    ]);

    // Previsto x realizado por lote
    const NIVEL = { acima: ['ACIMA', 'laranja'], abaixo: ['ABAIXO', 'laranja'], normal: ['NORMAL', 'verde'] };
    if (rel.secao('Previsto x realizado por lote', r.epoca ? `meta da época ${C().EPOCAS[r.epoca].nome.toLowerCase()} · até 10% = normal` : 'sem época marcada')) {
      rel.linha([{ t: 'Lote', w: 0.32 }, { t: 'Cabeças', w: 0.11, al: 'right' }, { t: 'g/cab/dia', w: 0.14, al: 'right' }, { t: 'Meta', w: 0.11, al: 'right' }, { t: 'Situação', w: 0.15, al: 'center' }, { t: 'R$/cab/dia', w: 0.17, al: 'right' }], { tam: 8, cor: COR.tinta2, b: true, alt: 6 });
      s.lotes.slice(0, 8).forEach((l) => {
        const nv = NIVEL[l.nivel];
        rel.linha([
          { t: `${l.numero} · ${l.nome}`, w: 0.32, b: true },
          { t: num(l.cabecas), w: 0.11, al: 'right' },
          { t: l.gramas !== null ? num(l.gramas) + ' g' : (l.kg > 0 ? null : '-'), w: 0.14, al: 'right', b: true },
          { t: l.meta ? num(l.meta) + ' g' : null, w: 0.11, al: 'right' },
          nv ? { t: nv[0], w: 0.15, selo: nv[1], al: 'center' } : { t: l.kg > 0 ? null : 'sem sal', w: 0.15, al: 'center' },
          { t: l.custoCabDia !== null ? reais(l.custoCabDia, 3) : (l.kg > 0 ? null : '-'), w: 0.17, al: 'right' },
        ]);
      });
      rel.y += 3;
    }

    // Perdas e problemas
    if (rel.secao('Perdas e problemas', `${p.quantidade} na semana`)) {
      const NOMES = (A.ui && A.ui.NOMES_PROBLEMA) || {};
      const linhas = p.problemas.map((x) => ({
        q: x.quando, a: `${NOMES[x.tipo] || 'Problema'}${x.insumoNome ? ': ' + x.insumoNome : ''}`,
        k: x.podeTerPerda ? kg(x.kg) : '-', rs: x.podeTerPerda ? reais(x.reais) : '-', st: x.resolvido ? ['RESOLVIDO', 'verde'] : ['ABERTO', 'vermelho'],
      })).concat(p.sumicos.map((x) => ({ q: x.quando, a: `Sumiu na contagem: ${x.insumoNome}`, k: kg(x.kg), rs: reais(x.reais), st: ['CONTAGEM', 'laranja'] })))
        .sort((a, b) => a.q.localeCompare(b.q));
      if (!linhas.length) rel.frase('Nenhum problema na semana.', { cor: COR.verdeEscuro, b: true });
      linhas.slice(0, 7).forEach((x) => {
        const d = new Date(x.q);
        rel.linha([
          { t: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, w: 0.09, cor: COR.tinta2 },
          { t: x.a, w: 0.44, b: true }, { t: x.k, w: 0.13, al: 'right' }, { t: x.rs, w: 0.16, al: 'right' },
          { t: x.st[0], w: 0.18, selo: x.st[1], al: 'right' },
        ]);
      });
      if (linhas.length > 7) rel.frase(`e mais ${linhas.length - 7} (veja no app)`);
      rel.y += 3;
    }

    // Estoque e lista de compras
    if (rel.secao('Estoque e compras', 'acaba em até 15 dias · compra para 30 dias')) {
      if (!r.estoque.length) rel.frase('Nada acabando em 15 dias.', { cor: COR.verdeEscuro, b: true });
      r.estoque.slice(0, 6).forEach((e) => {
        const sit = e.estoqueKg <= 0 ? 'ACABOU' : e.dias !== null ? `${e.dias} ${e.dias === 1 ? 'DIA' : 'DIAS'}` : 'ABAIXO DO MÍNIMO';
        rel.linha([
          { t: e.nome, w: 0.3, b: true }, { t: sit, w: 0.2, selo: e.nivel },
          { t: `tem ${kg(e.estoqueKg)}`, w: 0.16, al: 'right', cor: COR.tinta2 },
          { t: e.comprarUnidades ? (e.kgSaco ? `${e.comprarUnidades} sacos de ${num(e.kgSaco)} kg` : kg(e.comprarKg)) : '-', w: 0.2, al: 'right' },
          { t: e.comprarUnidades ? reais(e.comprarReais, 0) : '-', w: 0.14, al: 'right', b: true },
        ]);
      });
      const semPreco = r.estoque.filter((e) => e.comprarUnidades && e.comprarReais === null).length;
      const total = r.estoque.reduce((a, e) => a + (e.comprarReais || 0), 0);
      if (r.estoque.length) rel.linha([{ t: 'Total da compra', w: 0.7, b: true }, { t: `${reais(total, 0)}${semPreco ? ' + sem dado' : ''}`, w: 0.3, al: 'right', b: true }], { traco: false, fundo: COR.creme });
      rel.y += 3;
    }

    // Comparação com a semana anterior
    if (rel.secao('Comparação com a semana anterior')) {
      const c = r.comparacao;
      const varTxt = (v) => (v.pct === null || v.pct === undefined ? '' : `${v.dif > 0 ? '+' : v.dif < 0 ? '-' : ''}${num(Math.abs(v.pct * 100))}%`);
      const itens = [
        ['Gasto', c.gasto, (v) => reais(v, 0)], ['Sal feito', c.kgFeitos, kg], ['Misturas', c.misturas, (v) => (v === null ? null : String(v))],
        ['Custo/cab/dia', c.custoCabDia, (v) => reais(v, 2)], ['Perdas', c.perdasReais, (v) => reais(v, 0)], ['Problemas', c.problemas, (v) => (v === null ? null : String(v))],
      ];
      for (let i = 0; i < itens.length; i += 2) {
        const cols = [];
        [itens[i], itens[i + 1]].forEach(([rot, v, f]) => {
          cols.push({ t: rot, w: 0.15, cor: COR.tinta2 }, { t: f(v.atual), w: 0.12, al: 'right', b: true }, { t: `antes ${f(v.anterior) || SEM} ${varTxt(v)}`, w: 0.19, al: 'right', tam: 8.5, cor: COR.tinta2 }, { t: '', w: 0.04 });
        });
        rel.linha(cols);
      }
    }

    rel.rodape(`Gerado pelo Cocho em ${dataHora(Date.now())}. Gasto pelo custo do dia de cada mistura (compras no galpão; ESTIMADO = sem preço pago). Perdas e compras pelos preços de hoje. "sem dado" = falta preço ou informação.`);
    return { blob: rel.blob(), nome: nomeArquivo('Resumo', r.periodo.rotulo.replace(/\//g, '-'), r.nomeFazenda) };
  }

  // Salva o PDF no aparelho (pasta Downloads no Android; no iPhone abre a pré-visualização para salvar)
  function baixar(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ENVIAR NO WHATSAPP: abre o compartilhamento do celular com o PDF e a mensagem curta.
  // Se o celular não aceitar arquivo: salva o PDF e abre o WhatsApp só com a mensagem (no número do dono, se tiver).
  // A mensagem também vai para a área de transferência (alguns WhatsApp ignoram o texto junto do arquivo).
  // Devolve 'compartilhado', 'cancelado' ou 'whatsapp'.
  async function compartilhar(blob, nome, mensagem, numero) {
    try { if (navigator.clipboard) navigator.clipboard.writeText(mensagem).catch(() => {}); } catch (e) { /* sem área de transferência */ }
    const arquivo = new File([blob], nome, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], text: mensagem, title: nome.replace(/\.pdf$/, '') });
        return 'compartilhado';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelado'; // a pessoa fechou a lista sem escolher
        console.warn('Compartilhar com arquivo falhou:', e);
      }
    }
    baixar(blob, nome);
    const link = `https://wa.me/${numero || ''}?text=${encodeURIComponent(mensagem)}`;
    const janela = window.open(link, '_blank');
    if (!janela) location.href = link;
    return 'whatsapp';
  }

  // Botões de PDF das telas. fazer() devolve { blob, nome, mensagem }; modo 'whats' = compartilhar com a mensagem,
  // 'baixar' = salvar no celular. Mostra o aviso certo e devolve o que aconteceu.
  async function entregar(fazer, modo) {
    try {
      const numero = modo === 'whats' ? numeroWhats(await A.db.config('whatsDono')) : '';
      const { blob, nome, mensagem } = await fazer();
      if (modo === 'whats') {
        const como = await compartilhar(blob, nome, mensagem || nome.replace(/\.pdf$/, ''), numero);
        if (como === 'whatsapp') A.mostrarAviso('PDF salvo no celular. No WhatsApp, anexe o PDF (clipe).');
        else if (como === 'compartilhado') A.mostrarAviso('Enviado. A mensagem também foi copiada: se não aparecer, cole.');
        return como;
      }
      baixar(blob, nome);
      A.mostrarAviso('PDF pronto: ' + nome);
      return 'baixado';
    } catch (e) {
      console.error(e);
      A.mostrarAviso(modo === 'whats' ? 'Não deu para enviar. Tente BAIXAR PDF.' : 'Não deu para fazer o PDF. Tente de novo.', 'laranja');
      return 'erro';
    }
  }

  // Número para o link do WhatsApp: só dígitos, com 55 (Brasil) na frente quando faltar. Vazio = sem número.
  function numeroWhats(s) {
    const d = String(s || '').replace(/\D/g, '').replace(/^0+/, '');
    if (!d) return '';
    return d.length <= 11 ? '55' + d : d;
  }

  A.pdf = { carregar, logo, nomeArquivo, Relatorio, COR, resumo, baixar, texto, compartilhar, entregar, numeroWhats, num, reais, kg, dataHora, SEM };
})();
