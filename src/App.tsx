/* global globalThis */
import * as React from 'react';
import {memo, useCallback, useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {WebView} from '@amazon-devices/webview';
import {useTVEventHandler} from '@amazon-devices/react-native-kepler';
import {AudioPlayer} from '@amazon-devices/react-native-w3cmedia';

// >>> URL do monitoramento <<<
const URL_MONITORAMENTO = 'http://pangeiabrmk.dyndns.org:3000';

// Como manter a tela ativa:
//  'webview' -> o áudio de silêncio toca DENTRO da página (elemento <audio> em
//               loop do próprio navegador). Não usa o player nativo do Vega.
//  'nativo'  -> um único AudioPlayer nativo, criado uma vez só, que volta ao
//               início perto do fim (nunca cria player novo).
type Modo = 'webview' | 'nativo';
const MODO = 'webview' as Modo;

// Só para o modo 'nativo': MP3 empacotado em <projeto>/assets/silencio.mp3
const AUDIO_SILENCIO = 'file:///pkg/assets/silencio.mp3';
const MARGEM_FIM_SEG = 5;

// Barrinha de diagnóstico no canto da tela. Depois de estável, mude para false.
const MOSTRAR_DIAGNOSTICO = !!(globalThis as any).__DEV__;

// 'DEBUG' ou 'RELEASE': mostra na barrinha qual build está instalado.
const TIPO_BUILD = (globalThis as any).__DEV__ ? 'DEBUG' : 'RELEASE';

// 3 segundos de silêncio em MP3 (8 kbps), embutidos para o modo 'webview'.
const SILENCIO_B64 = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//NYwAAAAAAAAAAAAEluZm8AAAAPAAAAVgAADMwAEBMWGRweISEkJyotLzIyNTg7PUBDQ0ZJS05RVFRXWlxfYmVlaGptcHN2dnh7foGEh4mJjI+SlZeamp2go6Woq6uusbS2uby8v8LEx8rNzdDS1djb3t7h4+bp7O/v8fT3+v3/AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQDwAAAAAAAAAzMBiCkjgAAAAAAAAAAAAAA//MYxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVUxB//MYxBcAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxC4AAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxEUAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxFwAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxHMAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxIoAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxKEAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxLgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxM8AAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOYAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVUxB//MYxOgAAANIAAAAAE1FMy4xMDBVVVVVVVVVVVVVVVVVVVVV//MYxOgAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxOgAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxOgAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxOgAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxOgAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxOgAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxOgAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxOgAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxOgAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MYxOgAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

// Cursor virtual controlado pelo direcional do controle remoto.
// Setas movem (segurar acelera), OK clica, Play/Pause liga/desliga o cursor.
const USAR_CURSOR = true;

const SCRIPT_CURSOR = `
(function () {
  if (window.__cursorTV) { return; }
  var api = {viaPagina: false};
  window.__cursorTV = api;
  function enviar(o) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {}
  }

  var CFG = {
    velBase: 400,        // px por segundo ao começar a segurar
    multMax: 3,          // velocidade máxima = 3x a base (1200 px/s)
    rampaMs: 1000,       // tempo segurando até chegar na velocidade máxima
    seguracaMs: 800,     // segurança: para se ficar tanto tempo sem nenhum evento de tecla
    esconderMs: 6000,    // some depois de X ms parado (0 = nunca)
    bordaScroll: 40,     // distância da borda que começa a rolar a página
    velScroll: 600       // px por segundo de rolagem quando o cursor está na borda
  };

  var x = window.innerWidth / 2;
  var y = window.innerHeight / 2;
  var ligado = true;
  var cursor = null;
  var timerEsconder = null;
  var sobre = null;

  var dirs = {up: false, down: false, left: false, right: false};
  var inicioSegurar = 0;
  var ultimoEvento = 0;
  var rafId = 0;
  var tAnterior = 0;
  var ultimoMover = 0;

  function criarCursor() {
    if (cursor || !document.body) { return; }
    cursor = document.createElement('div');
    cursor.setAttribute('aria-hidden', 'true');
    cursor.style.cssText =
      'position:fixed;left:0;top:0;width:32px;height:32px;z-index:2147483647;' +
      'pointer-events:none;transition:opacity .3s;opacity:1;will-change:transform;';
    cursor.innerHTML =
      '<svg width="32" height="32" viewBox="0 0 32 32">' +
      '<path d="M3 2 L3 26 L9.5 20 L14 30 L18.5 28 L14 18.5 L23 18.5 Z" ' +
      'fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cursor);
    desenhar();
  }

  function desenhar() {
    if (!cursor) { return; }
    cursor.style.transform = 'translate3d(' + (x - 3) + 'px,' + (y - 2) + 'px,0)';
    cursor.style.display = ligado ? 'block' : 'none';
    cursor.style.opacity = '1';
    if (timerEsconder) { clearTimeout(timerEsconder); }
    if (CFG.esconderMs > 0) {
      timerEsconder = setTimeout(function () {
        if (cursor) { cursor.style.opacity = '0'; }
      }, CFG.esconderMs);
    }
  }

  function alvo() {
    var el = document.elementFromPoint(x, y);
    return el || document.body;
  }

  function evMouse(tipo, el, extra) {
    var o = {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: x, clientY: y, screenX: x, screenY: y,
      button: 0, buttons: (tipo === 'mousedown' || tipo === 'pointerdown') ? 1 : 0
    };
    if (extra) { for (var k in extra) { o[k] = extra[k]; } }
    var ev;
    if (tipo.indexOf('pointer') === 0 && typeof PointerEvent === 'function') {
      o.pointerId = 1; o.pointerType = 'mouse'; o.isPrimary = true;
      ev = new PointerEvent(tipo, o);
    } else {
      ev = new MouseEvent(tipo, o);
    }
    el.dispatchEvent(ev);
  }

  function mover() {
    var el = alvo();
    if (el !== sobre) {
      if (sobre) {
        evMouse('pointerout', sobre, {relatedTarget: el});
        evMouse('mouseout', sobre, {relatedTarget: el});
        evMouse('pointerleave', sobre, {bubbles: false, relatedTarget: el});
        evMouse('mouseleave', sobre, {bubbles: false, relatedTarget: el});
      }
      evMouse('pointerover', el, {relatedTarget: sobre});
      evMouse('mouseover', el, {relatedTarget: sobre});
      evMouse('pointerenter', el, {bubbles: false, relatedTarget: sobre});
      evMouse('mouseenter', el, {bubbles: false, relatedTarget: sobre});
      sobre = el;
    }
    evMouse('pointermove', el);
    evMouse('mousemove', el);
  }

  function desc(n) {
    if (!n) { return '-'; }
    return n.tagName + (n.id ? '#' + n.id : '') + (n.type ? '[' + n.type + ']' : '');
  }

  // Acha o campo/botão do clique, mesmo se o ponto caiu na borda ou num contêiner do campo.
  function achaControle(el) {
    if (!el || !el.closest) { return null; }
    var c = el.closest('input,textarea,select,button,a,[contenteditable="true"],[tabindex]');
    if (c) { return c; }
    var lab = el.closest('label');
    if (lab && lab.control) { return lab.control; }
    var p = el;
    for (var i = 0; i < 2 && p; i++) {
      var campos = p.querySelectorAll ? p.querySelectorAll('input,textarea,select') : [];
      if (campos.length === 1) { return campos[0]; }
      p = p.parentElement;
    }
    return null;
  }

  function focar(c) {
    try { c.focus({preventScroll: true}); } catch (e) { try { c.focus(); } catch (e2) {} }
    try {
      if (c.setSelectionRange && c.value !== undefined) {
        var n = c.value.length;
        c.setSelectionRange(n, n);
      }
    } catch (e) {}
  }

  // O foco acompanha o cursor: o OK nativo da TV cai no campo que está sob a seta.
  function sincronizarFoco() {
    if (!ligado) { return; }
    var ctl = achaControle(alvo());
    if (ctl && document.activeElement !== ctl) { focar(ctl); }
  }

  // Detecta clique nativo (o do sistema, não o nosso) para não clicar duas vezes.
  var ultimoNativo = 0;
  var nativoEl = null;
  document.addEventListener('click', function (e) {
    if (e.isTrusted) { ultimoNativo = Date.now(); nativoEl = e.target; }
  }, true);

  // Clique simulado de verdade (hover + foco + eventos de mouse).
  function executarClique() {
    var el = alvo();
    var antes = document.activeElement;
    evMouse('pointerdown', el);
    evMouse('mousedown', el);
    var ctl = achaControle(el);
    if (ctl) {
      if (antes && antes !== ctl && typeof antes.blur === 'function') {
        try { antes.blur(); } catch (e) {}
      }
      focar(ctl);
      // Se o foco nativo devolver o foco ao campo antigo, retoma.
      setTimeout(function () {
        if (document.activeElement !== ctl) { focar(ctl); }
        enviar({tipo: 'cursor', msg: 'clique em ' + desc(el) + ' | campo: ' + desc(ctl) +
          ' | ativo: ' + desc(document.activeElement)});
      }, 150);
    } else {
      enviar({tipo: 'cursor', msg: 'clique em ' + desc(el) + ' | sem campo'});
    }
    evMouse('pointerup', el);
    evMouse('mouseup', el);
    evMouse('click', el, {detail: 1});
    // <select> nativo não abre com clique simulado: avança para a próxima opção.
    if (ctl && ctl.tagName === 'SELECT' && ctl.options.length) {
      ctl.selectedIndex = (ctl.selectedIndex + 1) % ctl.options.length;
      ctl.dispatchEvent(new Event('input', {bubbles: true}));
      ctl.dispatchEvent(new Event('change', {bubbles: true}));
    }
  }

  var ultimoClique = 0;

  function clicar() {
    var agora = Date.now();
    if (agora - ultimoClique < 300) { return; }   // ignora OK duplicado
    ultimoClique = agora;
    mover();
    sincronizarFoco();
    setTimeout(function () {
      var el = alvo();
      var c = achaControle(el) || el;
      var mesmo = nativoEl && (nativoEl === c ||
        (c.contains && c.contains(nativoEl)) || (nativoEl.contains && nativoEl.contains(c)));
      if (Date.now() - ultimoNativo < 500 && mesmo) {
        enviar({tipo: 'cursor', msg: 'clique nativo no mesmo alvo; ignorei o simulado'});
        return;
      }
      executarClique();
    }, 120);
  }

  function rolavel(el, dx, dy) {
    while (el && el !== document.body && el !== document.documentElement) {
      var st = getComputedStyle(el);
      var podeY = dy !== 0 && /(auto|scroll|overlay)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1;
      var podeX = dx !== 0 && /(auto|scroll|overlay)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 1;
      if (podeY || podeX) {
        var antesT = el.scrollTop, antesL = el.scrollLeft;
        el.scrollBy(dx, dy);
        if (el.scrollTop !== antesT || el.scrollLeft !== antesL) { return true; }
      }
      el = el.parentElement;
    }
    var aT = window.scrollY, aL = window.scrollX;
    window.scrollBy(dx, dy);
    return window.scrollY !== aT || window.scrollX !== aL;
  }

  // Rolagem proporcional ao tempo do quadro (dt em ms).
  function rolarSePreciso(dx, dy, dt) {
    var w = window.innerWidth, h = window.innerHeight, b = CFG.bordaScroll;
    var p = Math.max(1, Math.round(CFG.velScroll * dt / 1000));
    var sx = 0, sy = 0;
    if (dy > 0 && y >= h - b) { sy = p; }
    if (dy < 0 && y <= b) { sy = -p; }
    if (dx > 0 && x >= w - b) { sx = p; }
    if (dx < 0 && x <= b) { sx = -p; }
    if (sx || sy) { rolavel(alvo(), sx, sy); }
  }

  // ----- Movimento fluido: um loop por quadro, com delta time -----

  function algumaDirecao() {
    return dirs.up || dirs.down || dirs.left || dirs.right;
  }

  function quadro(t) {
    rafId = 0;
    if (!algumaDirecao()) { return; }
    var agora = Date.now();
    if (agora - ultimoEvento > CFG.seguracaMs) { soltarTudo(); return; }

    var dt = Math.min(t - tAnterior, 50);
    tAnterior = t;
    if (dt < 0) { dt = 0; }

    var dx = (dirs.right ? 1 : 0) - (dirs.left ? 1 : 0);
    var dy = (dirs.down ? 1 : 0) - (dirs.up ? 1 : 0);
    if (dx || dy) {
      var len = Math.sqrt(dx * dx + dy * dy);
      var progresso = Math.min(1, (agora - inicioSegurar) / CFG.rampaMs);
      var fator = 1 + (CFG.multMax - 1) * progresso;
      var passo = CFG.velBase * fator * dt / 1000;
      x = Math.max(0, Math.min(window.innerWidth - 1, x + (dx / len) * passo));
      y = Math.max(0, Math.min(window.innerHeight - 1, y + (dy / len) * passo));
      desenhar();
      if (t - ultimoMover > 40) { ultimoMover = t; mover(); }
      rolarSePreciso(dx, dy, dt);
    }
    rafId = requestAnimationFrame(quadro);
  }

  function iniciarLoop() {
    if (rafId) { return; }
    tAnterior = performance.now();
    rafId = requestAnimationFrame(quadro);
  }

  function pressionar(nome) {
    criarCursor();
    var tinha = algumaDirecao();
    dirs[nome] = true;
    ultimoEvento = Date.now();
    if (!tinha) { inicioSegurar = ultimoEvento; }
    iniciarLoop();
  }

  function soltar(nome) {
    dirs[nome] = false;
    if (!algumaDirecao()) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      mover();
      sincronizarFoco();
    }
  }

  function soltarTudo() {
    dirs.up = dirs.down = dirs.left = dirs.right = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    mover();
    sincronizarFoco();
  }

  var NOMES = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Up: 'up', Down: 'down', Left: 'left', Right: 'right'
  };
  var CODIGOS = {38: 'ArrowUp', 40: 'ArrowDown', 37: 'ArrowLeft', 39: 'ArrowRight'};

  function nomeTecla(e) {
    return e.key && e.key !== 'Unidentified' ? e.key : (CODIGOS[e.keyCode] || '');
  }

  function ehAlternar(e) {
    // Play/Pause liga e desliga o cursor (volta à navegação normal).
    return e.key === 'MediaPlayPause' || e.key === 'MediaPlay' || e.key === 'MediaPause' ||
      e.keyCode === 179 || e.keyCode === 85;
  }

  // Comandos vindos do app (quando o controle não chega como tecla na página).
  // 'up'/'down'/'left'/'right' = apertou; 'solta_up' etc. = soltou.
  api.comando = function (c) {
    if (api.viaPagina) { return; }
    criarCursor();
    if (c === 'alternar') {
      ligado = !ligado;
      if (!ligado) { soltarTudo(); }
      desenhar();
      return;
    }
    if (!ligado) { return; }
    if (c === 'ok') { desenhar(); clicar(); return; }
    if (c.indexOf('solta_') === 0) { soltar(c.substring(6)); return; }
    if (dirs.hasOwnProperty(c)) { pressionar(c); }
  };

  window.addEventListener('keydown', function (e) {
    criarCursor();
    enviar({tipo: 'tecla', msg: (e.key || '?') + ' / ' + e.keyCode});
    if (ehAlternar(e)) {
      ligado = !ligado;
      if (!ligado) { soltarTudo(); }
      desenhar();
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (!ligado) { return; }

    var tecla = nomeTecla(e);
    var nome = NOMES[tecla];
    var ok = tecla === 'Enter' || e.keyCode === 13 || e.keyCode === 23;
    if (nome || ok) {
      if (!api.viaPagina) {
        api.viaPagina = true;
        enviar({tipo: 'cursor', msg: 'teclas chegam na página (' + tecla + ')'});
      }
      e.preventDefault(); e.stopImmediatePropagation();
    }
    if (nome) { pressionar(nome); return; }
    if (ok && !e.repeat) { desenhar(); clicar(); }
  }, true);

  window.addEventListener('keyup', function (e) {
    if (!ligado) { return; }
    var tecla = nomeTecla(e);
    var nome = NOMES[tecla];
    if (nome) { soltar(nome); }
    if (nome || tecla === 'Enter' || e.keyCode === 13 || e.keyCode === 23) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('keypress', function (e) {
    if (!ligado) { return; }
    if (e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 23) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('blur', soltarTudo);

  window.addEventListener('resize', function () {
    x = Math.min(x, window.innerWidth - 1);
    y = Math.min(y, window.innerHeight - 1);
    desenhar();
  });

  function garantir() {
    if (cursor && !cursor.isConnected) { cursor = null; }
    criarCursor();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', garantir);
  } else {
    garantir();
  }
  setInterval(garantir, 2000);
  var avisado = false;
  var avisar = setInterval(function () {
    if (cursor && !avisado) {
      avisado = true;
      clearInterval(avisar);
      enviar({tipo: 'cursor', msg: 'cursor criado (' + window.innerWidth + 'x' + window.innerHeight + ')'});
    }
  }, 1000);
  enviar({tipo: 'cursor', msg: 'script carregado'});
})();
`;

// Script injetado na página antes de ela carregar.
// Cria um <audio> invisível em loop e manda o estado para o app a cada 15 s.
const SCRIPT_WEBVIEW = `
(function () {
  if (window.__keepAwake) { return; }
  window.__keepAwake = true;
  function enviar(o) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {}
  }
  function iniciar() {
    try {
      var a = document.createElement('audio');
      a.src = 'data:audio/mpeg;base64,${SILENCIO_B64}';
      a.loop = true;
      a.setAttribute('playsinline', '');
      a.style.display = 'none';
      (document.body || document.documentElement).appendChild(a);
      var tocar = function () {
        var p = a.play();
        if (p && p.catch) {
          p.catch(function (e) { enviar({tipo: 'erro', msg: 'play: ' + e}); });
        }
      };
      a.addEventListener('error', function () {
        enviar({tipo: 'erro', msg: 'audio code ' + (a.error ? a.error.code : '?')});
      });
      tocar();
      setInterval(function () {
        if (a.paused) { tocar(); }
        enviar({tipo: 'estado', tocando: !a.paused});
      }, 15000);
      enviar({tipo: 'estado', tocando: !a.paused});
    } catch (e) {
      enviar({tipo: 'erro', msg: 'iniciar: ' + e});
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
true;
`;

// ---------- Diagnóstico (estado fora do App, para não redesenhar a página) ----------

type Diag = {
  estado: string;
  ultimoErro: string;
  horaErro: string;
  voltas: number;
  inicio: number;
  cursor: string;
  teclaPagina: string;
  teclaApp: string;
};

let diag: Diag = {
  estado: 'iniciando',
  ultimoErro: '',
  horaErro: '',
  voltas: 0,
  inicio: Date.now(),
  cursor: 'sem notícia do script',
  teclaPagina: '-',
  teclaApp: '-',
};
const ouvintes = new Set<(d: Diag) => void>();
const atualizarDiag = (parcial: Partial<Diag>) => {
  diag = {...diag, ...parcial};
  ouvintes.forEach(f => f(diag));
};

const hora = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
};

const descreverErro = (e: unknown) => {
  if (e instanceof Error) {
    return `${e.name}: ${e.message}`;
  }
  try {
    return typeof e === 'string' ? e : JSON.stringify(e);
  } catch {
    return String(e);
  }
};

const registrarErro = (origem: string, e: unknown) => {
  const msg = `[${origem}] ${descreverErro(e)}`;
  console.error('[keepawake]', msg);
  atualizarDiag({ultimoErro: msg, horaErro: hora()});
};

const Diagnostico = () => {
  const [d, setD] = useState(diag);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    ouvintes.add(setD);
    const t = setInterval(() => setAgora(Date.now()), 30 * 1000);
    return () => {
      ouvintes.delete(setD);
      clearInterval(t);
    };
  }, []);
  const min = Math.floor((agora - d.inicio) / 60000);
  const tempo = `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  return (
    <View style={styles.diag} pointerEvents="none">
      <Text style={styles.diagTexto}>
        build: {TIPO_BUILD} · modo: {MODO} · áudio: {d.estado} · aberto há{' '}
        {tempo}
        {MODO === 'nativo' ? ` · voltas: ${d.voltas}` : ''}
      </Text>
      <Text style={styles.diagTexto}>
        cursor: {d.cursor} · tecla na página: {d.teclaPagina} · tecla no app:{' '}
        {d.teclaApp}
      </Text>
      {d.ultimoErro !== '' && (
        <Text style={styles.diagErro}>
          {d.horaErro} {d.ultimoErro}
        </Text>
      )}
    </View>
  );
};

// ---------- Página (memo: só desenha uma vez) ----------

const webRef = React.createRef<any>();

const Pagina = memo(() => {
  const onMessage = useCallback((e: any) => {
    try {
      const m = JSON.parse(e?.nativeEvent?.data ?? '{}');
      if (m.tipo === 'cursor') {
        atualizarDiag({cursor: m.msg});
      } else if (m.tipo === 'tecla') {
        atualizarDiag({teclaPagina: m.msg});
      } else if (m.tipo === 'estado') {
        atualizarDiag({estado: m.tocando ? 'tocando' : 'pausado'});
      } else if (m.tipo === 'erro') {
        registrarErro('página/áudio', m.msg);
      }
    } catch {
      // mensagem que não é nossa: ignora
    }
  }, []);
  const onError = useCallback(
    (e: any) => registrarErro('página', e?.nativeEvent?.description ?? e),
    [],
  );
  const onHttpError = useCallback(
    (e: any) =>
      registrarErro('página HTTP', e?.nativeEvent?.statusCode ?? e),
    [],
  );

  const extras =
    MODO === 'webview'
      ? {
          mediaPlaybackRequiresUserAction: false,
        }
      : {};

  const scripts =
    (USAR_CURSOR ? SCRIPT_CURSOR : '') +
    '\n' +
    (MODO === 'webview' ? SCRIPT_WEBVIEW : 'true;');

  return (
    <WebView
      hasTVPreferredFocus={true}
      domStorageEnabled={true}
      javaScriptEnabled={true}
      source={{uri: URL_MONITORAMENTO}}
      onError={onError}
      onHttpError={onHttpError}
      ref={webRef}
      injectedJavaScriptBeforeContentLoaded={scripts}
      onMessage={onMessage}
      {...extras}
    />
  );
});

// ---------- Modo nativo: UM player só, nunca recriado ----------

const usePlayerNativo = (ligado: boolean) => {
  const iniciado = useRef(false);
  useEffect(() => {
    if (!ligado || iniciado.current) {
      return;
    }
    iniciado.current = true;
    let ativo = true;
    const audio = new AudioPlayer();
    let vigia: ReturnType<typeof setInterval> | undefined;

    const seguro = (origem: string, fn: () => unknown) => {
      try {
        const r = fn() as any;
        if (r && typeof r.catch === 'function') {
          r.catch((e: unknown) => registrarErro(origem, e));
        }
      } catch (e) {
        registrarErro(origem, e);
      }
    };

    audio
      .initialize()
      .then(() => {
        if (!ativo) {
          return;
        }
        audio.addEventListener('error', () => registrarErro('áudio', 'erro no player'));
        audio.addEventListener('ended', () => {
          registrarErro('áudio', 'chegou ao fim; voltando ao início');
          seguro('volta', () => {
            audio.currentTime = 0;
          });
          seguro('play', () => audio.play());
        });
        audio.autoplay = true;
        audio.src = AUDIO_SILENCIO;
        atualizarDiag({estado: 'tocando'});

        vigia = setInterval(() => {
          if (!ativo) {
            return;
          }
          try {
            const pos = audio.currentTime;
            const dur = audio.duration;
            if (isFinite(dur) && dur > MARGEM_FIM_SEG * 2 && pos > dur - MARGEM_FIM_SEG) {
              audio.currentTime = 0;
              atualizarDiag({voltas: diag.voltas + 1});
            }
            if (audio.paused) {
              seguro('play', () => audio.play());
            }
            atualizarDiag({estado: audio.paused ? 'pausado' : 'tocando'});
          } catch (e) {
            registrarErro('vigia', e);
          }
        }, 2000);
      })
      .catch(e => registrarErro('iniciar', e));

    return () => {
      ativo = false;
      if (vigia) {
        clearInterval(vigia);
      }
      seguro('pause', () => audio.pause());
      seguro('deinit', () => audio.deinitialize());
    };
  }, [ligado]);
};

// ---------- App ----------

export const App = () => {
  // Erros de JavaScript aparecem na tela em vez de fechar o app.
  useEffect(() => {
    const EU = (globalThis as any).ErrorUtils;
    if (!EU?.setGlobalHandler) {
      return;
    }
    const anterior = EU.getGlobalHandler?.();
    EU.setGlobalHandler((erro: unknown, fatal?: boolean) => {
      registrarErro(fatal ? 'ERRO FATAL' : 'erro', erro);
    });
    return () => {
      if (anterior) {
        EU.setGlobalHandler(anterior);
      }
    };
  }, []);

  usePlayerNativo(MODO === 'nativo');

  // Plano B do cursor: o app recebe o controle remoto e manda o comando para a página.
  // Se as teclas já chegam na própria página, o script ignora estes comandos.
  useTVEventHandler((ev: any) => {
    const tipo: string = ev?.eventType ?? '';
    const acao = ev?.eventKeyAction;
    atualizarDiag({teclaApp: `${tipo}/${acao}`});

    const mapa: Record<string, string> = {
      up: 'up',
      down: 'down',
      left: 'left',
      right: 'right',
      select: 'ok',
      enter: 'ok',
      playpause: 'alternar',
    };
    const cmd = mapa[tipo];
    if (!USAR_CURSOR || !cmd) {
      return;
    }
    let comando = cmd;
    if (acao === 1) {
      // soltou o botão: só as setas precisam avisar, OK e Play/Pause não
      if (cmd === 'ok' || cmd === 'alternar') {
        return;
      }
      comando = 'solta_' + cmd;
    }
    try {
      webRef.current?.injectJavaScript(
        `window.__cursorTV && window.__cursorTV.comando && window.__cursorTV.comando('${comando}'); true;`,
      );
    } catch (e) {
      registrarErro('cursor/app', e);
    }
  });

  return (
    <View style={styles.container}>
      <Pagina />
      {MOSTRAR_DIAGNOSTICO && <Diagnostico />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: 'black'},
  diag: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    maxWidth: '60%',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  diagTexto: {color: '#cfcfcf', fontSize: 14},
  diagErro: {color: '#ff6b6b', fontSize: 16, marginTop: 4, fontWeight: '600'},
});
