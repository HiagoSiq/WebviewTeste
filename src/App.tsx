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
const MOSTRAR_DIAGNOSTICO = true;

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
    passoMin: 6,         // px por toque
    passoMax: 48,        // px por repetição quando o botão fica pressionado
    aceleracao: 1.25,    // quanto acelera a cada repetição
    esconderMs: 6000,    // some depois de X ms parado (0 = nunca)
    bordaScroll: 40,     // distância da borda que começa a rolar a página
    passoScroll: 60      // px de rolagem por toque na borda
  };

  var x = window.innerWidth / 2;
  var y = window.innerHeight / 2;
  var ligado = true;
  var veloc = CFG.passoMin;
  var ultimaTecla = 0;
  var cursor = null;
  var timerEsconder = null;
  var sobre = null;

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
    cursor.style.transform = 'translate(' + (x - 3) + 'px,' + (y - 2) + 'px)';
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

  function clicar() {
    var el = alvo();
    evMouse('pointerdown', el);
    evMouse('mousedown', el);
    var focavel = el.closest ? el.closest('input,textarea,select,button,a,[tabindex],[contenteditable="true"]') : null;
    if (focavel && typeof focavel.focus === 'function') {
      try { focavel.focus({preventScroll: true}); } catch (e) { focavel.focus(); }
    }
    evMouse('pointerup', el);
    evMouse('mouseup', el);
    evMouse('click', el, {detail: 1});
    // <select> nativo não abre com clique simulado: avança para a próxima opção.
    if (focavel && focavel.tagName === 'SELECT' && focavel.options.length) {
      focavel.selectedIndex = (focavel.selectedIndex + 1) % focavel.options.length;
      focavel.dispatchEvent(new Event('input', {bubbles: true}));
      focavel.dispatchEvent(new Event('change', {bubbles: true}));
    }
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

  function rolarSePreciso(dx, dy) {
    var w = window.innerWidth, h = window.innerHeight, b = CFG.bordaScroll;
    var sx = 0, sy = 0;
    if (dy > 0 && y >= h - b) { sy = CFG.passoScroll; }
    if (dy < 0 && y <= b) { sy = -CFG.passoScroll; }
    if (dx > 0 && x >= w - b) { sx = CFG.passoScroll; }
    if (dx < 0 && x <= b) { sx = -CFG.passoScroll; }
    if (sx || sy) { rolavel(alvo(), sx, sy); }
  }

  var DIRECOES = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    Up: [0, -1], Down: [0, 1], Left: [-1, 0], Right: [1, 0]
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

  function andar(dx, dy, repetindo) {
    criarCursor();
    var agora = Date.now();
    if (repetindo || agora - ultimaTecla < 180) {
      veloc = Math.min(CFG.passoMax, veloc * CFG.aceleracao);
    } else {
      veloc = CFG.passoMin;
    }
    ultimaTecla = agora;
    x = Math.max(0, Math.min(window.innerWidth - 1, x + dx * veloc));
    y = Math.max(0, Math.min(window.innerHeight - 1, y + dy * veloc));
    desenhar();
    mover();
    rolarSePreciso(dx, dy);
  }

  // Comandos vindos do app (quando o controle não chega como tecla na página).
  api.comando = function (c) {
    if (api.viaPagina) { return; }
    criarCursor();
    if (c === 'alternar') { ligado = !ligado; desenhar(); return; }
    if (!ligado) { return; }
    if (c === 'ok') { desenhar(); clicar(); return; }
    var d = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]}[c];
    if (d) { andar(d[0], d[1], false); }
  };

  window.addEventListener('keydown', function (e) {
    criarCursor();
    enviar({tipo: 'tecla', msg: (e.key || '?') + ' / ' + e.keyCode});
    if (ehAlternar(e)) {
      ligado = !ligado;
      desenhar();
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (!ligado) { return; }

    var tecla = nomeTecla(e);
    var d = DIRECOES[tecla];
    var ok = tecla === 'Enter' || e.keyCode === 13 || e.keyCode === 23;
    if (d || ok) {
      if (!api.viaPagina) {
        api.viaPagina = true;
        enviar({tipo: 'cursor', msg: 'teclas chegam na página (' + tecla + ')'});
      }
      e.preventDefault(); e.stopImmediatePropagation();
    }
    if (d) { andar(d[0], d[1], e.repeat); return; }
    if (ok) { desenhar(); clicar(); }
  }, true);

  // Também bloqueia o keyup das setas/OK, para a página não reagir a eles.
  window.addEventListener('keyup', function (e) {
    if (!ligado) { return; }
    var tecla = nomeTecla(e);
    if (DIRECOES[tecla] || tecla === 'Enter' || e.keyCode === 13 || e.keyCode === 23) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);

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
    if (!USAR_CURSOR || acao === 1) {
      return; // só reage ao apertar, não ao soltar
    }
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
    if (cmd) {
      try {
        webRef.current?.injectJavaScript(
          `window.__cursorTV && window.__cursorTV.comando && window.__cursorTV.comando('${cmd}'); true;`,
        );
      } catch (e) {
        registrarErro('cursor/app', e);
      }
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
