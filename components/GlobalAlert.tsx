import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert, Animated, TouchableWithoutFeedback } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react-native';

// Simple event emitter for alerts
type AlertData = {
  title: string;
  message?: string;
  buttons?: { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[];
  options?: { cancelable?: boolean; onDismiss?: () => void };
};

let alertListener: ((data: AlertData) => void) | null = null;

// Overriding default Alert.alert
const originalAlert = Alert.alert;
Alert.alert = (title, message, buttons, options) => {
  if (alertListener) {
    alertListener({ title, message, buttons, options });
  } else {
    // Fallback to native if listener not ready
    originalAlert(title, message, buttons, options);
  }
};

export default function GlobalAlert() {
  const [visible, setVisible] = useState(false);
  const [alertData, setAlertData] = useState<AlertData | null>(null);
  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [opacityAnim] = useState(new Animated.Value(0));

  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  useEffect(() => {
    alertListener = (data) => {
      setAlertData(data);
      setVisible(true);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    };

    return () => {
      alertListener = null;
    };
  }, []);

  const closeAlert = (onPress?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      setVisible(false);
      setAlertData(null);
      if (onPress) onPress();
    });
  };

  const handleCancelable = () => {
    if (alertData?.options?.cancelable !== false) {
      closeAlert(alertData?.options?.onDismiss);
    }
  };

  if (!visible || !alertData) return null;

  const defaultButtons = [{ text: 'OK', onPress: () => {} }];
  const buttons = alertData.buttons && alertData.buttons.length > 0 ? alertData.buttons : defaultButtons;

  // Determine icon based on title
  const t = alertData.title.toLowerCase();
  let IconComponent = Info;
  let iconColor = theme.tint;
  
  if (t.includes('gagal') || t.includes('error') || t.includes('kesalahan') || t.includes('diblokir')) {
    IconComponent = XCircle;
    iconColor = '#EF4444'; // Red
  } else if (t.includes('berhasil') || t.includes('sukses')) {
    IconComponent = CheckCircle2;
    iconColor = '#10B981'; // Green
  } else if (t.includes('peringatan') || t.includes('yakin')) {
    IconComponent = AlertTriangle;
    iconColor = '#F59E0B'; // Amber
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleCancelable}>
      <TouchableWithoutFeedback onPress={handleCancelable}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View 
              style={[
                styles.alertBox, 
                { backgroundColor: theme.card, transform: [{ scale: scaleAnim }] }
              ]}
            >
              <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
                <IconComponent size={32} color={iconColor} />
              </View>
              
              <Text style={[styles.title, { color: theme.text }]}>{alertData.title}</Text>
              
              {alertData.message ? (
                <Text style={[styles.message, { color: theme.description }]}>
                  {alertData.message}
                </Text>
              ) : null}

              <View style={styles.buttonContainer}>
                {buttons.map((btn, index) => {
                  const isDestructive = btn.style === 'destructive';
                  const isCancel = btn.style === 'cancel';
                  const isPrimary = !isDestructive && !isCancel && (index === buttons.length - 1);
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        isPrimary && { backgroundColor: theme.tint, borderWidth: 0 },
                        isCancel && { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1 },
                        isDestructive && { backgroundColor: '#EF4444', borderWidth: 0 },
                        buttons.length === 2 && { flex: 1, marginLeft: index > 0 ? 10 : 0 },
                        buttons.length > 2 && { width: '100%', marginBottom: index < buttons.length - 1 ? 10 : 0 }
                      ]}
                      onPress={() => closeAlert(btn.onPress)}
                      activeOpacity={0.7}
                    >
                      <Text 
                        style={[
                          styles.buttonText,
                          isPrimary && { color: '#FFF' },
                          isCancel && { color: theme.text },
                          isDestructive && { color: '#FFF' },
                          (!isPrimary && !isCancel && !isDestructive) && { color: theme.tint }
                        ]}
                      >
                        {btn.text || 'OK'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  alertBox: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
