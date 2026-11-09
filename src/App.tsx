/* global globalThis */
import * as React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {WebView} from '@amazon-devices/webview';
import {AudioPlayer} from '@amazon-devices/react-native-w3cmedia';

// >>> URL do monitoramento <<<
const URL_MONITORAMENTO = 'http://pangeiabrmk.dyndns.org:3000';

// MP3 de silêncio empacotado em <projeto>/assets/silencio.mp3
const AUDIO_SILENCIO = 'file:///pkg/assets/silencio.mp3';

// Mostra a barrinha de diagnóstico no canto da tela.
// Depois que tudo estiver estável, mude para false.
const MOSTRAR_DIAGNOSTICO = true;

// Quantos segundos antes do fim do áudio ele volta para o início.
// Assim o áudio nunca chega ao fim (que é onde o app estava fechando).
const MARGEM_FIM_SEG = 30;

// De quanto em quanto tempo o "vigia" confere o áudio.
const INTERVALO_VIGIA_MS = 5 * 1000;

type Status = {
  estado: string;
  posicao: number;
  duracao: number;
  voltas: number;
  recriacoes: number;
  ultimoErro: string;
  horaErro: string;
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

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) {
    return '--:--';
  }
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

export const App = () => {
  const webRef = useRef(null);
  const [status, setStatus] = useState<Status>({
    estado: 'iniciando',
    posicao: 0,
    duracao: 0,
    voltas: 0,
    recriacoes: 0,
    ultimoErro: '',
    horaErro: '',
  });

  const registrarErro = useCallback((origem: string, e: unknown) => {
    const msg = `[${origem}] ${descreverErro(e)}`;
    console.error('[keepawake]', msg);
    setStatus(s => ({...s, ultimoErro: msg, horaErro: hora()}));
  }, []);

  // 1) Captura erros de JavaScript que antes fechariam o app.
  //    Em vez de fechar, o erro aparece na tela.
  useEffect(() => {
    const EU = (globalThis as any).ErrorUtils;
    if (!EU?.setGlobalHandler) {
      return;
    }
    const anterior = EU.getGlobalHandler?.();
    EU.setGlobalHandler((erro: unknown, fatal?: boolean) => {
      registrarErro(fatal ? 'ERRO FATAL' : 'erro', erro);
      // Não repassa ao handler padrão, que encerraria o app.
    });
    return () => {
      if (anterior) {
        EU.setGlobalHandler(anterior);
      }
    };
  }, [registrarErro]);

  // 2) Captura promessas rejeitadas sem tratamento (quando o motor Hermes permite).
  useEffect(() => {
    try {
      const H = (globalThis as any).HermesInternal;
      H?.enablePromiseRejectionTracker?.({
        allRejections: true,
        onUnhandled: (_id: number, erro: unknown) =>
          registrarErro('promessa', erro),
      });
    } catch (e) {
      console.log('[keepawake] rastreador de promessas indisponível', e);
    }
  }, [registrarErro]);

  // 3) Áudio de silêncio que mantém a tela ativa.
  useEffect(() => {
    let ativo = true;
    let audio: AudioPlayer | null = null;
    let recriando = false;

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

    const criarPlayer = async () => {
      const p = new AudioPlayer();
      await p.initialize();
      if (!ativo) {
        seguro('deinit', () => p.deinitialize());
        return;
      }
      p.addEventListener('error', () => {
        const err = (p as any).error;
        registrarErro(
          'áudio',
          err ? `código ${err.code} ${err.message ?? ''}` : 'erro no player',
        );
      });
      p.addEventListener('ended', () => {
        // Não deveria acontecer (voltamos antes do fim), mas se acontecer
        // recriamos o player em vez de tentar reaproveitar o antigo.
        registrarErro('áudio', 'chegou ao fim; recriando player');
        recriarPlayer();
      });
      p.autoplay = true;
      p.src = AUDIO_SILENCIO;
      audio = p;
      setStatus(s => ({...s, estado: 'tocando'}));
    };

    const recriarPlayer = () => {
      if (recriando || !ativo) {
        return;
      }
      recriando = true;
      const antigo = audio;
      audio = null;
      if (antigo) {
        seguro('pause', () => antigo.pause());
        seguro('deinit', () => antigo.deinitialize());
      }
      criarPlayer()
        .then(() =>
          setStatus(s => ({...s, recriacoes: s.recriacoes + 1})),
        )
        .catch(e => registrarErro('recriar', e))
        .finally(() => {
          recriando = false;
        });
    };

    criarPlayer().catch(e => registrarErro('iniciar', e));

    const vigia = setInterval(() => {
      if (!ativo || !audio || recriando) {
        return;
      }
      try {
        const pos = audio.currentTime;
        const dur = audio.duration;
        const pausado = audio.paused;

        setStatus(s => ({
          ...s,
          posicao: pos,
          duracao: dur,
          estado: pausado ? 'pausado' : 'tocando',
        }));

        // Perto do fim: volta para o início enquanto ainda está tocando.
        if (isFinite(dur) && dur > MARGEM_FIM_SEG * 2 && pos > dur - MARGEM_FIM_SEG) {
          audio.currentTime = 0;
          setStatus(s => ({...s, voltas: s.voltas + 1}));
        }

        if (pausado) {
          seguro('play', () => audio!.play());
        }
      } catch (e) {
        registrarErro('vigia', e);
        recriarPlayer();
      }
    }, INTERVALO_VIGIA_MS);

    return () => {
      ativo = false;
      clearInterval(vigia);
      const p = audio;
      audio = null;
      if (p) {
        seguro('pause', () => p.pause());
        seguro('deinit', () => p.deinitialize());
      }
    };
  }, [registrarErro]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        hasTVPreferredFocus={true}
        domStorageEnabled={true}
        source={{uri: URL_MONITORAMENTO}}
        onError={(e: any) =>
          registrarErro('página', e?.nativeEvent?.description ?? e)
        }
        onHttpError={(e: any) =>
          registrarErro('página HTTP', e?.nativeEvent?.statusCode ?? e)
        }
      />

      {MOSTRAR_DIAGNOSTICO && (
        <View style={styles.diag} pointerEvents="none">
          <Text style={styles.diagTexto}>
            áudio: {status.estado} {fmt(status.posicao)}/{fmt(status.duracao)} ·
            voltas: {status.voltas} · recriações: {status.recriacoes}
          </Text>
          {status.ultimoErro !== '' && (
            <Text style={styles.diagErro}>
              {status.horaErro} {status.ultimoErro}
            </Text>
          )}
        </View>
      )}
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
