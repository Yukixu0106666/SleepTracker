import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import { Button, Modal, StyleSheet, Text, View } from 'react-native';

export default function SleepScreen() {
  const [sleepStart, setSleepStart] = useState<Date | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showConfirmStop, setShowConfirmStop] = useState(false);
  const [message, setMessage] = useState('');

  const handleToggleSleep = () => {
    if (!sleepStart) {
      // Start sleep
      setSleepStart(new Date());
    } else {
      // Ask to confirm stop
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

      if (durationHours >= minRecommended) {
        setMessage(`🎉 You slept ${durationHours}h. Great job, no advice needed today!`);
      } else {
        setMessage(
          `😴 You slept ${durationHours}h, less than the recommended ${minRecommended}h.\n\n💡 Tips:\n- Eat a protein-rich breakfast\n- Take a walk outdoors\n- Avoid caffeine late\n- Sleep 30 mins earlier tonight`
        );
      }
    } else {
      setMessage(`You slept ${durationHours}h.`);
    }

    // Reset
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Track Your Sleep</Text>
      <Button
        title={sleepStart ? 'Stop Sleep' : 'Start Sleep'}
        onPress={handleToggleSleep}
        color={sleepStart ? '#d9534f' : '#5cb85c'}
      />

      {/* Confirm Stop Modal */}
      <Modal visible={showConfirmStop} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>Are you sure you want to stop sleep?</Text>
            <View style={styles.buttonRow}>
              <Button title="No" onPress={() => setShowConfirmStop(false)} />
              <View style={{ width: 20 }} />
              <Button title="Yes" onPress={stopSleep} color="#d9534f" />
            </View>
          </View>
        </View>
      </Modal>

      {/* Summary Modal */}
      <Modal visible={showSummaryModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>{message}</Text>
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
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
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
  },
});
