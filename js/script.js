window.addEventListener('DOMContentLoaded', () => {
  // 1. Seleção de elementos do DOM
  const canvas = document.getElementById('coloring-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  
  const botoesCor = document.querySelectorAll('.cor-btn');
  const inputCor = document.getElementById('seletor-cor');
  const btnBucket = document.getElementById('btn-bucket');
  const btnBrush = document.getElementById('btn-brush');
  const btnUndo = document.getElementById('btn-undo');
  const btnClear = document.getElementById('btn-clear');
  const btnDownload = document.getElementById('btn-download');
  const btnMural = document.getElementById('btn-mural');
  const inputNomeArtista = document.getElementById('nome-artista');
  const muralGrid = document.getElementById('mural-grid');

  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');

  // Lógica do Mural de Artes (Executa apenas se estiver na página mural.html)
  if (muralGrid) {
    const artes = JSON.parse(localStorage.getItem('bloomist_mural') || '[]');
    muralGrid.innerHTML = '';

    if (artes.length === 0) {
      muralGrid.innerHTML = '<p style="grid-column: 1/-1; color: #8A9A86; text-align: center;">Nenhuma arte publicada ainda. Seja o primeiro a pintar no Ateliê!</p>';
    } else {
      artes.reverse().forEach(arte => {
        const card = document.createElement('div');
        card.className = 'mural-card';
        card.innerHTML = `
          <img src="${arte.imagem}" alt="Arte por ${arte.nome}">
          <p>🎨 ${arte.nome}</p>
        `;
        muralGrid.appendChild(card);
      });
    }
  }

  // Se não houver canvas na página atual, encerra aqui
  if (!canvas) return;

  // 2. Variáveis de Estado
  let corAtual = '#C87D82'; 
  let modoAtual = 'bucket';  
  let desenhando = false;
  let historico = [];
  let zoomLevel = 1;

  // 3. Carregamento do Desenho
  const urlParams = new URLSearchParams(window.location.search);
  const idDesenho = urlParams.get('desenho') || '1';
  
  const imagemDesenho = new Image();
  imagemDesenho.src = `img/desenho${idDesenho}.jpg`;
  
  imagemDesenho.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagemDesenho, 0, 0, canvas.width, canvas.height);
    salvarEstado();
  };

  function salvarEstado() {
    if (historico.length >= 10) historico.shift();
    historico.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }

  // 4. Lógica de Zoom
  function aplicarZoom(novoZoom) {
    zoomLevel = Math.min(Math.max(0.8, novoZoom), 3);
    canvas.style.transform = `scale(${zoomLevel})`;
  }

  if (btnZoomIn) btnZoomIn.addEventListener('click', () => aplicarZoom(zoomLevel + 0.25));
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => aplicarZoom(zoomLevel - 0.25));
  if (btnZoomReset) btnZoomReset.addEventListener('click', () => aplicarZoom(1));

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      aplicarZoom(zoomLevel + 0.15);
    } else {
      aplicarZoom(zoomLevel - 0.15);
    }
  }, { passive: false });

  // 5. Paleta de Cores
  botoesCor.forEach(btn => {
    btn.addEventListener('click', (e) => {
      botoesCor.forEach(b => b.classList.remove('ativa'));
      const botaoSelecionado = e.target;
      botaoSelecionado.classList.add('ativa');
      corAtual = botaoSelecionado.getAttribute('data-color');
      if (inputCor) inputCor.value = corAtual;
    });
  });

  if (inputCor) {
    inputCor.addEventListener('input', (e) => {
      corAtual = e.target.value;
      botoesCor.forEach(b => b.classList.remove('ativa'));
    });
  }

  // 6. Ferramentas
  if (btnBucket) {
    btnBucket.addEventListener('click', () => {
      modoAtual = 'bucket';
      btnBucket.classList.remove('secundario');
      if (btnBrush) btnBrush.classList.add('secundario');
    });
  }

  if (btnBrush) {
    btnBrush.addEventListener('click', () => {
      modoAtual = 'brush';
      btnBrush.classList.remove('secundario');
      if (btnBucket) btnBucket.classList.add('secundario');
    });
  }

  // 7. Algoritmo do Balde
  function hexToRgba(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
  }

  function preencherBalde(startX, startY, hexColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const targetColor = hexToRgba(hexColor);

    const startPos = (startY * canvas.width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];

    if (Math.abs(startR - targetColor[0]) < 5 && 
        Math.abs(startG - targetColor[1]) < 5 && 
        Math.abs(startB - targetColor[2]) < 5) return;

    if (startR < 50 && startG < 50 && startB < 50) return;

    const pixelStack = [[startX, startY]];
    let loops = 0;
    const maxLoops = canvas.width * canvas.height;

    while (pixelStack.length > 0 && loops < maxLoops) {
      loops++;
      const newPos = pixelStack.pop();
      const x = newPos[0];
      let y = newPos[1];

      let pixelPos = (y * canvas.width + x) * 4;

      while (y-- >= 0 && matchColor(pixelPos)) {
        pixelPos -= canvas.width * 4;
      }
      pixelPos += canvas.width * 4;
      ++y;

      let reachLeft = false;
      let reachRight = false;

      while (y++ < canvas.height - 1 && matchColor(pixelPos)) {
        colorPixel(pixelPos);

        if (x > 0) {
          if (matchColor(pixelPos - 4)) {
            if (!reachLeft) {
              pixelStack.push([x - 1, y]);
              reachLeft = true;
            }
          } else if (reachLeft) {
            reachLeft = false;
          }
        }

        if (x < canvas.width - 1) {
          if (matchColor(pixelPos + 4)) {
            if (!reachRight) {
              pixelStack.push([x + 1, y]);
              reachRight = true;
            }
          } else if (reachRight) {
            reachRight = false;
          }
        }

        pixelPos += canvas.width * 4;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    salvarEstado();

    function matchColor(pos) {
      const r = data[pos];
      const g = data[pos + 1];
      const b = data[pos + 2];
      return Math.abs(r - startR) < 25 && Math.abs(g - startG) < 25 && Math.abs(b - startB) < 25;
    }

    function colorPixel(pos) {
      data[pos] = targetColor[0];
      data[pos + 1] = targetColor[1];
      data[pos + 2] = targetColor[2];
      data[pos + 3] = 255;
    }
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / zoomLevel) * (canvas.width / (rect.width / zoomLevel)));
    const y = Math.floor(((e.clientY - rect.top) / zoomLevel) * (canvas.height / (rect.height / zoomLevel)));
    return { x, y };
  }

  // 8. Eventos de Pintura
  canvas.addEventListener('mousedown', (e) => {
    const { x, y } = getCanvasCoords(e);

    if (modoAtual === 'bucket') {
      preencherBalde(x, y, corAtual);
    } else {
      desenhando = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!desenhando || modoAtual !== 'brush') return;
    const { x, y } = getCanvasCoords(e);

    ctx.strokeStyle = corAtual;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  });

  canvas.addEventListener('mouseup', () => {
    if (desenhando) {
      desenhando = false;
      salvarEstado();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (desenhando) {
      desenhando = false;
      salvarEstado();
    }
  });

  // 9. Desfazer e Limpar
  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      if (historico.length > 1) {
        historico.pop();
        ctx.putImageData(historico[historico.length - 1], 0, 0);
      }
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imagemDesenho, 0, 0, canvas.width, canvas.height);
      salvarEstado();
    });
  }

  function aplicarAssinatura(nome) {
    ctx.font = 'italic 14px sans-serif';
    ctx.fillStyle = 'rgba(248, 237, 226, 0.85)';
    ctx.fillRect(canvas.width - 310, canvas.height - 35, 300, 25);
    ctx.fillStyle = '#493C35';
    ctx.textAlign = 'right';
    ctx.fillText(`Colorido por: ${nome} • Mundo SENAI`, canvas.width - 15, canvas.height - 18);
  }

  // 10. Publicar no Mural e Redirecionar
  if (btnMural) {
    btnMural.addEventListener('click', () => {
      const nomeArtista = inputNomeArtista && inputNomeArtista.value.trim() !== '' 
        ? inputNomeArtista.value.trim() 
        : 'Artista Anônimo';

      aplicarAssinatura(nomeArtista);

      const imagemURI = canvas.toDataURL('image/png');
      const artes = JSON.parse(localStorage.getItem('bloomist_mural') || '[]');

      artes.push({ nome: nomeArtista, imagem: imagemURI });
      if (artes.length > 12) artes.shift();

      localStorage.setItem('bloomist_mural', JSON.stringify(artes));

      alert(`Parabéns, ${nomeArtista}! Sua arte foi enviada para o Mural!`);
      window.location.href = 'mural.html'; // Redireciona diretamente para o Mural
    });
  }

  // 11. Download
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      const nomeArtista = inputNomeArtista && inputNomeArtista.value.trim() !== '' 
        ? inputNomeArtista.value.trim() 
        : 'Artista Anônimo';

      aplicarAssinatura(nomeArtista);

      const imageURI = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `bloomist-${nomeArtista.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = imageURI;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }
});