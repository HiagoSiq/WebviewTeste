import * as React from 'react';
import {useEffect, useRef} from 'react';
import {View, StyleSheet} from 'react-native';
import {WebView} from '@amazon-devices/webview';
import {AudioPlayer} from '@amazon-devices/react-native-w3cmedia';

// >>> Troque pela URL do seu monitoramento <<<
const URL_MONITORAMENTO = 'http://pangeiabrmk.dyndns.org:3000';

// MP3 de silêncio empacotado em <projeto>/assets/silencio.mp3
// Se não tocar, troque por uma URL http(s) (ex.: servido pelo seu PC).
const AUDIO_SILENCIO = 'file:///pkg/assets/silencio.mp3';

export const App = () => {
  const webRef = useRef(null);

  useEffect(() => {
    const audio = new AudioPlayer();
    let ativo = true;

    const tocarDeNovo = () => {
      if (!ativo) return;
      try {
        audio.currentTime = 0;
        audio.play();
      } catch (e) {
        console.log('[keepawake] falha ao reiniciar', e);
      }
    };

    audio.initialize().then(() => {
      if (!ativo) return;
      audio.addEventListener('ended', tocarDeNovo);
      audio.addEventListener('error', () =>
        console.log('[keepawake] erro no áudio'),
      );
      audio.autoplay = true;
      audio.src = AUDIO_SILENCIO;
    });

    // Rede de segurança: se o áudio parar por qualquer motivo, retoma.
    const vigia = setInterval(() => {
      if (ativo && audio.paused) {
        audio.play();
      }
    }, 60 * 1000);

    return () => {
      ativo = false;
      clearInterval(vigia);
      audio.removeEventListener('ended', tocarDeNovo);
      audio.pause();
      (audio as any).deinitialize?.();
    };
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        hasTVPreferredFocus={true}
         domStorageEnabled={true}
        source={{uri: URL_MONITORAMENTO}}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: 'black'},
});
