import { SleepSyncSettings } from '../../components/SleepSyncSettings';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
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
import { useLanguage } from '../../theme/LanguageContext';

export default function SettingsScreen() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState<any>(null);

  const { theme, toggleTheme } = useThemeContext();
  const { language, setLanguage, t } = useLanguage();
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
      Alert.alert(t('validProfile'));
      return;
    }

    const profile = { name, age, height, weight, photo };
    await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
    setSavedProfile(profile);
    Alert.alert(t('profileSaved'));
  };

  const handleChoosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('mediaPermission'));
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
      Alert.alert(t('cameraPermission'));
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
        <Text style={[styles.title, isDark && styles.titleDark]}>{t('settings')}</Text>

        <View style={styles.photoActions}>
          <Text style={[styles.photoLabel, isDark && styles.titleDark]}>{t('profilePhoto')}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={photo ? t('changePhoto') : t('uploadPhoto')}
            onPress={handleChoosePhoto}
            style={[styles.photoPicker, isDark && styles.photoPickerDark]}
          >
            {photo ? (
              <Image source={{ uri: photo }} style={styles.profilePhoto} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={34} color={isDark ? '#9CC7D8' : '#176C89'} />
                <Text style={[styles.uploadPhotoText, isDark && styles.uploadPhotoTextDark]}>{t('upload')}</Text>
              </>
            )}
            {photo && (
              <View style={styles.changePhotoBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={[styles.photoHint, isDark && styles.photoHintDark]}>{t('tapToUpload')}</Text>

          <View style={styles.photoButtons}>
            <Pressable style={styles.smallButton} onPress={handleTakePhoto}>
              <Text style={styles.smallButtonText}>{t('takePhoto')}</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={handleDeletePhoto}>
              <Text style={styles.smallButtonText}>{t('delete')}</Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder={t('name')}
          placeholderTextColor={isDark ? '#aaa' : undefined}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder={t('age')}
          placeholderTextColor={isDark ? '#aaa' : undefined}
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder={t('height')}
          placeholderTextColor={isDark ? '#aaa' : undefined}
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder={t('weight')}
          placeholderTextColor={isDark ? '#aaa' : undefined}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
        />

        <Pressable style={styles.saveButton} onPress={saveProfile}>
          <Text style={styles.saveButtonText}>{t('saveProfile')}</Text>
        </Pressable>

        <View style={[styles.languageSection, isDark && styles.languageSectionDark]}>
          <Text style={[styles.languageLabel, isDark && styles.titleDark]}>{t('language')}</Text>
          <View style={styles.languageOptions}>
            {(['en', 'zh'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: language === option }}
                onPress={() => setLanguage(option)}
                style={[styles.languageOption, language === option && styles.languageOptionSelected]}
              >
                <Text style={[styles.languageOptionText, language === option && styles.languageOptionTextSelected]}>
                  {option === 'en' ? t('english') : t('chinese')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable style={styles.toggleButton} onPress={toggleTheme}>
          <Text style={styles.saveButtonText}>{t('toggleTheme')}</Text>
        </Pressable>

        <SleepSyncSettings />

        {savedProfile && (
          <View style={[styles.profileSection, isDark && styles.profileSectionDark]}>
            <Text style={[styles.profileHeader, isDark && styles.titleDark]}>{t('yourProfile')}</Text>
            <Text style={[styles.profileText, isDark && styles.titleDark]}>{t('name')}: {savedProfile.name}</Text>
            <Text style={[styles.profileText, isDark && styles.titleDark]}>{t('age')}: {savedProfile.age}</Text>
            <Text style={[styles.profileText, isDark && styles.titleDark]}>{t('height')}: {savedProfile.height} cm</Text>
            <Text style={[styles.profileText, isDark && styles.titleDark]}>{t('weight')}: {savedProfile.weight} kg</Text>
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
    backgroundColor: '#176C89',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  toggleButton: {
    backgroundColor: '#176C89',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  languageSection: {
    backgroundColor: '#F1F7F9',
    borderRadius: 8,
    marginBottom: 20,
    padding: 14,
  },
  languageSectionDark: {
    backgroundColor: '#1E293B',
  },
  languageLabel: {
    color: '#123044',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  languageOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  languageOption: {
    alignItems: 'center',
    borderColor: '#A8C8D3',
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  languageOptionSelected: {
    backgroundColor: '#176C89',
    borderColor: '#176C89',
  },
  languageOptionText: {
    color: '#176C89',
    fontSize: 15,
    fontWeight: '700',
  },
  languageOptionTextSelected: {
    color: '#fff',
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
  photoLabel: {
    color: '#123044',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  photoPicker: {
    alignItems: 'center',
    backgroundColor: '#E9F4F7',
    borderColor: '#176C89',
    borderRadius: 64,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 128,
    justifyContent: 'center',
    overflow: 'visible',
    width: 128,
  },
  photoPickerDark: {
    backgroundColor: '#17364B',
    borderColor: '#9CC7D8',
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    resizeMode: 'cover',
  },
  uploadPhotoText: {
    color: '#176C89',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  uploadPhotoTextDark: {
    color: '#9CC7D8',
  },
  changePhotoBadge: {
    alignItems: 'center',
    backgroundColor: '#176C89',
    borderColor: '#fff',
    borderRadius: 17,
    borderWidth: 2,
    bottom: -2,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 34,
  },
  photoHint: {
    color: '#53707D',
    fontSize: 13,
    marginTop: 9,
  },
  photoHintDark: {
    color: '#9CC7D8',
  },
  photoButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  smallButton: {
    backgroundColor: '#176C89',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});
