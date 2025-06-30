import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import {
  Button,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemeContext } from '../../theme/ThemeContext'; // ✅ Add this line

export default function SleepScreen() {
  const [sleepStart, setSleepStart] = useState<Date | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showConfirmStop, setShowConfirmStop] = useState(false);
  const [message, setMessage] = useState('');

  const { theme } = useThemeContext(); // ✅ Get current theme
  const isDark = theme === 'dark';

  const handleToggleSleep = () => {
    if (!sleepStart) {
      setSleepStart(new Date());
    } else {
      setShowConfirmStop(true);
    }
  };

  const stopSleep = async () => {
    if (!sleepStart) return;

    const end = new Date();
    const durationMs = end.getTime() - sleepStart.getTime();
    const durationHours = +(durationMs / (1000 * 60 * 60)).toFixed(2);

    const session = {
      start: sleepStart.toISOString(),
      end: end.toISOString(),
      duration: durationHours,
    };

    await AsyncStorage.setItem('lastSleepSession', JSON.stringify(session));

    const historyData = await AsyncStorage.getItem('sleepHistory');
    const history = historyData ? JSON.parse(historyData) : [];
    history.push(session);
    await AsyncStorage.setItem('sleepHistory', JSON.stringify(history));

    const profileData = await AsyncStorage.getItem('userProfile');
    if (profileData) {
      const { age } = JSON.parse(profileData);
      const ageNum = parseInt(age, 10);
      const [minRecommended] = getRecommendedSleep(ageNum);

      const dietaryTip = getDietaryAdvice(ageNum);
      const activityTip = getAgeBasedAdvice(ageNum);

      const baseAdvice =
        durationHours >= minRecommended
          ? `🎉 You slept ${durationHours}h. Great job!`
          : `😴 You slept ${durationHours}h, less than the recommended ${minRecommended}h.\n\n💡 Tips:\n${dietaryTip}\n- Take a walk outdoors\n- Avoid caffeine late\n- Sleep 30 mins earlier tonight`;

      setMessage(`${baseAdvice}\n\n👟 Recommended Activity:\n${activityTip}`);
    } else {
      setMessage(`You slept ${durationHours}h.`);
    }

    setSleepStart(null);
    setShowConfirmStop(false);
    setShowSummaryModal(true);
  };

  const getRecommendedSleep = (age: number): [number, number] => {
    if (age < 1) return [12, 16];
    if (age < 3) return [11, 14];
    if (age < 6) return [10, 13];
    if (age < 13) return [9, 12];
    if (age < 19) return [8, 10];
    if (age < 65) return [7, 9];
    return [7, 8];
  };

  const getDietaryAdvice = (age: number): string => {
    if (age < 13) {
      return (
        '- Include calcium-rich foods like milk, yogurt, and cheese\n' +
        '- Offer iron-rich foods: eggs, lean meat, beans\n' +
        '- Keep them hydrated: water, diluted juice\n' +
        '- Provide small healthy snacks between meals'
      );
    } else if (age < 19) {
      return (
        '- Eat protein-rich meals: eggs, chicken, tofu\n' +
        '- Include complex carbs: oats, brown rice, whole wheat bread\n' +
        '- Stay hydrated: 6–8 glasses of water daily\n' +
        '- Avoid junk food and excess sugar'
      );
    } else if (age < 40) {
      return (
        '- Balance all macros: protein, carbs, and healthy fats\n' +
        '- Eat fiber-rich foods: vegetables, legumes, whole grains\n' +
        '- Drink at least 2L of water daily\n' +
        '- Limit caffeine and sugary drinks'
      );
    } else if (age < 60) {
      return (
        '- Focus on heart-healthy foods: fish, olive oil, avocado\n' +
        '- Add more vegetables and fruits in every meal\n' +
        '- Choose low-sodium, low-sugar options\n' +
        '- Eat smaller portions, more frequently if needed'
      );
    } else {
      return (
        '- Prioritize bone health: include dairy or calcium-fortified foods\n' +
        '- Choose soft foods if chewing is a challenge\n' +
        '- Eat light, easily digestible meals\n' +
        '- Reduce salt and avoid heavy dinners'
      );
    }
  };

  const getAgeBasedAdvice = (age: number): string => {
    if (age < 13) {
      return '- Play outside for at least 1 hour\n- Light games or swimming\n- Avoid screen time before bed';
    } else if (age < 19) {
      return '- Join a sports team or play basketball\n- 1–2 hours of physical activity\n- Limit sugar and screen time';
    } else if (age < 40) {
      return '- Jog or swim 3–5 times a week\n- Take breaks from long sitting sessions\n- Stretch in the morning';
    } else if (age < 60) {
      return '- Walk 30 mins daily\n- Do light strength training\n- Avoid heavy meals late at night';
    } else {
      return '- Gentle yoga or tai chi\n- Morning sunlight exposure\n- Take short naps if needed';
    }
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Text style={[styles.title, isDark && styles.textDark]}>Track Your Sleep</Text>
      <Button
        title={sleepStart ? 'Stop Sleep' : 'Start Sleep'}
        onPress={handleToggleSleep}
        color={sleepStart ? '#d9534f' : '#5cb85c'}
      />

      <Modal visible={showConfirmStop} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, isDark && styles.modalDark]}>
            <Text style={[styles.modalText, isDark && styles.textDark]}>
              Are you sure you want to stop sleep?
            </Text>
            <View style={styles.buttonRow}>
              <Button title="No" onPress={() => setShowConfirmStop(false)} />
              <View style={{ width: 20 }} />
              <Button title="Yes" onPress={stopSleep} color="#d9534f" />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSummaryModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, isDark && styles.modalDark]}>
            <Text style={[styles.modalText, isDark && styles.textDark]}>{message}</Text>
            <Button title="Close" onPress={() => setShowSummaryModal(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#0A1627',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000',
  },
  textDark: {
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalDark: {
    backgroundColor: '#1E293B',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#000',
  },
  buttonRow: {
    flexDirection: 'row',
  },
});
