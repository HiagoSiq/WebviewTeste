import * as React from 'react';
import {render} from '@testing-library/react-native';
import {App} from '../src/App';

jest.mock('@amazon-devices/webview', () => ({
  WebView: 'WebView',
}));

// O AudioPlayer depende de módulo nativo do Fire TV; no teste usamos uma versão falsa.
jest.mock('@amazon-devices/react-native-w3cmedia', () => ({
  AudioPlayer: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(() => Promise.resolve()),
    deinitialize: jest.fn(() => Promise.resolve()),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    paused: false,
    currentTime: 0,
    duration: 3600,
  })),
}));

jest.mock('@amazon-devices/react-native-kepler', () => ({
  usePreventHideSplashScreen: jest.fn(),
  useTVEventHandler: jest.fn(),
  useHideSplashScreenCallback: jest.fn(() => jest.fn()),
  StyleSheet: {create: (styles: unknown) => styles},
  View: 'View',
  Text: 'Text',
}));

describe('App', () => {
  it('renders without crashing', () => {
    const {toJSON} = render(<App />);
    expect(toJSON()).toBeTruthy();
  });
});
