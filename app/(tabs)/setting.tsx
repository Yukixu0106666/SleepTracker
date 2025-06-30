import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useThemeContext } from '../../theme/ThemeContext';

export default function SettingsScreen() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState<any>(null);

  const { theme, toggleTheme } = useThemeContext();
  const isDark = theme === 'dark';

  useEffect(() => {
    const loadProfile = async () => {
      const data = await AsyncStorage.getItem('userProfile');
      if (data) {
        const profile = JSON.parse(data);
        setName(profile.name || '');
        setAge(profile.age || '');
        setHeight(profile.height || '');
        setWeight(profile.weight || '');
        setPhoto(profile.photo || null);
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

    const profile = { name, age, height, weight, photo };
    await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
    setSavedProfile(profile);
    Alert.alert('Profile saved!');
  };

  const handleChoosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission to access media library is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission to access camera is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleDeletePhoto = () => {
    setPhoto(null);
  };

  return (
    <ScrollView contentContainerStyle={[styles.scrollContainer, isDark && styles.scrollContainerDark]}>
      <View style={styles.innerContainer}>
        <Text style={[styles.title, isDark && styles.titleDark]}>Settings</Text>

        <View style={styles.photoActions}>
          <TouchableOpacity onPress={handleChoosePhoto}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.placeholderCircle}>
                <Ionicons name="camera-outline" size={36} color="#888" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.photoButtons}>
            <Pressable style={styles.smallButton} onPress={handleTakePhoto}>
              <Text style={styles.smallButtonText}>📷 Take Photo</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={handleDeletePhoto}>
              <Text style={styles.smallButtonText}>❌ Delete</Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Name"
          placeholderTextColor={isDark ? '#aaa' : undefined}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Age"
          placeholderTextColor={isDark ? '#aaa' : undefined}
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Height (cm)"
          placeholderTextColor={isDark ? '#aaa' : undefined}
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Weight (kg)"
          placeholderTextColor={isDark ? '#aaa' : undefined}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
        />

        <Pressable style={styles.saveButton} onPress={saveProfile}>
          <Text style={styles.saveButtonText}>💾 Save Profile</Text>
        </Pressable>

        <Pressable style={styles.toggleButton} onPress={toggleTheme}>
          <Text style={styles.saveButtonText}>🌓 Toggle Theme</Text>
        </Pressable>

        {savedProfile && (
          <View style={[styles.profileSection, isDark && styles.profileSectionDark]}>
            <Text style={[styles.profileHeader, isDark && styles.titleDark]}>Your Profile:</Text>
            <Text style={[styles.profileText, isDark && styles.titleDark]}>Name: {savedProfile.name}</Text>
            <Text style={[styles.profileText, isDark && styles.titleDark]}>Age: {savedProfile.age}</Text>
            <Text style={[styles.profileText, isDark && styles.titleDark]}>Height: {savedProfile.height} cm</Text>
            <Text style={[styles.profileText, isDark && styles.titleDark]}>Weight: {savedProfile.weight} kg</Text>
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
  scrollContainerDark: {
    backgroundColor: '#0A1627',
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
  titleDark: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 16,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
    color: '#000',
  },
  inputDark: {
    backgroundColor: '#1E293B',
    color: '#fff',
    borderColor: '#444',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  toggleButton: {
    backgroundColor: '#6B7280',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
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
  profileSectionDark: {
    backgroundColor: '#1E293B',
  },
  profileHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  profileText: {
    fontSize: 16,
    marginBottom: 4,
  },
  photoActions: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    resizeMode: 'cover',
  },
  placeholderCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  photoButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  smallButton: {
    backgroundColor: '#64748B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});
