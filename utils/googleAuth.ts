import { Platform } from 'react-native';

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export const loadGoogleScript = (): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || Platform.OS !== 'web') {
      resolve();
      return;
    }

    if (document.getElementById('google-client-script')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_URL;
    script.id = 'google-client-script';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
};

/**
 * Modern Helper for Google Login on Web that returns idToken
 */
export const loginRequestWeb = (clientId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'web') return reject('Not on web');

    if (!window.google) {
      return reject(new Error('Google SDK not loaded'));
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: any) => {
        if (response.credential) {
          resolve(response.credential);
        } else {
          reject(new Error('Google Sign-In failed'));
        }
      },
      auto_select: false,
    });

    window.google.accounts.id.prompt();
  });
};
