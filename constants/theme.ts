/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#F8F9FA', // Fresh Soft Grey Background
    tint: '#1D4289', // Metamedia Navy
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#1D4289',
    primary: '#1D4289', // Navy
    accent: '#FBC02D', // Golden Yellow
    brandRed: '#E31E24',
    white: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E9ECEF',
    description: '#6C757D',
    surface: '#FFFFFF',
    shadow: '#0000000a',
  },
  dark: {
    text: '#ECEDEE',
    background: '#121212',
    tint: '#FBC02D', // Accents in Dark mode
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#FBC02D',
    primary: '#1D4289',
    accent: '#FBC02D',
    brandRed: '#E31E24',
    white: '#1E1E1E',
    card: '#1E1E1E',
    border: '#333333',
    description: '#A1A1A1',
    surface: '#1E1E1E',
    shadow: '#000000',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
