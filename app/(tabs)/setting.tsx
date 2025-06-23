import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function SettingsScreen() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [savedProfile, setSavedProfile] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const data = await AsyncStorage.getItem('userProfile');
      if (data) {
        const profile = JSON.parse(data);
        setName(profile.name || '');
        setAge(profile.age || '');
        setHeight(profile.height || '');
        setWeight(profile.weight || '');
        setSavedProfile(profile);
      }
    };
    loadProfile();
  }, []);

  const saveProfile = async () => {
    if (!name || !age || isNaN(parseInt(age))) {
      Alert.alert('Please enter a valid name and numeric age.');
      return;
    }

    const profile = { name, age, height, weight };
    await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
    setSavedProfile(profile);
    Alert.alert('Profile saved!');
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.innerContainer}>
        <Text style={styles.title}>Settings</Text>

        <TextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Age"
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Height (cm)"
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
        />
        <TextInput
          style={styles.input}
          placeholder="Weight (kg)"
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
        />

        <Pressable style={styles.saveButton} onPress={saveProfile}>
          <Text style={styles.saveButtonText}>💾 Save Profile</Text>
        </Pressable>

        {savedProfile && (
          <View style={styles.profileSection}>
            <Text style={styles.profileHeader}>Your Profile:</Text>
            <Text>Name: {savedProfile.name}</Text>
            <Text>Age: {savedProfile.age}</Text>
            <Text>Height: {savedProfile.height} cm</Text>
            <Text>Weight: {savedProfile.weight} kg</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 90,
    paddingBottom: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  innerContainer: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 16,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  profileSection: {
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 8,
  },
  profileHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
});
