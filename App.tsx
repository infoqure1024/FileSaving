import React, { useCallback, useMemo, useState } from 'react';
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import RNFS, {
  DownloadDirectoryPath,
  DocumentDirectoryPath,
  ExternalDirectoryPath,
  ExternalStorageDirectoryPath,
} from 'react-native-fs';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

type Feedback = {
  type: 'success' | 'error';
  message: string;
};

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView
        style={[
          styles.safeArea,
          isDarkMode ? styles.darkBackground : styles.lightBackground,
        ]}
      >
        <AppContent isDarkMode={isDarkMode} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

type AppContentProps = {
  isDarkMode: boolean;
};

function AppContent({ isDarkMode }: AppContentProps): React.JSX.Element {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const targetDirectory = useMemo(() => {
    if (Platform.OS === 'ios') {
      return DocumentDirectoryPath;
    }

    if (DownloadDirectoryPath) {
      return DownloadDirectoryPath;
    }

    if (ExternalDirectoryPath) {
      return ExternalDirectoryPath;
    }

    return ExternalStorageDirectoryPath ?? DocumentDirectoryPath;
  }, []);

  const ensureAndroidPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const androidVersion =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(Platform.Version, 10);

    if (Number.isFinite(androidVersion) && androidVersion >= 33) {
      return true;
    }

    const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;

    const alreadyGranted = await PermissionsAndroid.check(permission);
    if (alreadyGranted) {
      return true;
    }

    const result = await PermissionsAndroid.request(permission, {
      title: 'ストレージへのアクセス許可',
      message:
        '保存したテキストをファイルアプリで確認できるようにするため、' +
        'ストレージへの書き込みを許可してください。',
      buttonPositive: '許可する',
      buttonNegative: '許可しない',
    });

    return result === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = text.trim();

    if (!trimmed) {
      setFeedback({
        type: 'error',
        message: '保存する前にテキストを入力してください。',
      });
      return;
    }

    if (!targetDirectory) {
      setFeedback({
        type: 'error',
        message: '保存先のディレクトリを特定できませんでした。',
      });
      return;
    }

    if (Platform.OS === 'android') {
      const granted = await ensureAndroidPermission();
      if (!granted) {
        setFeedback({
          type: 'error',
          message:
            '保存に必要な権限がありません。設定からストレージへのアクセスを許可してください。',
        });
        return;
      }
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const fileName = buildFileName();
      const filePath = `${targetDirectory}/${fileName}`;
      await RNFS.writeFile(filePath, trimmed, 'utf8');

      setFeedback({
        type: 'success',
        message: `保存しました: ${filePath}`,
      });
      setText('');
    } catch (error) {
      console.warn('Failed to write file', error);
      setFeedback({
        type: 'error',
        message:
          'ファイルの保存に失敗しました。アプリを再起動するか、権限設定を確認してください。',
      });
    } finally {
      setIsSaving(false);
    }
  }, [ensureAndroidPermission, targetDirectory, text]);

  const buttonDisabled = isSaving || !text.trim();

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.title,
          isDarkMode ? styles.lightText : styles.darkText,
        ]}
      >
        テキストをファイルに保存
      </Text>
      <Text
        style={[
          styles.body,
          isDarkMode ? styles.lightText : styles.darkText,
        ]}
      >
        入力した内容をテキストファイルとして保存し、ファイルアプリから開けるようにします。
      </Text>

      <TextInput
        value={text}
        multiline
        placeholder="ここにテキストを入力してください"
        placeholderTextColor={isDarkMode ? '#bbbbbb' : '#666666'}
        onChangeText={setText}
        style={[
          styles.textInput,
          isDarkMode ? styles.inputDark : styles.inputLight,
        ]}
      />

      <Pressable
        accessibilityRole="button"
        onPress={handleSave}
        disabled={buttonDisabled}
        style={({ pressed }) => [
          styles.button,
          isDarkMode ? styles.buttonDark : styles.buttonLight,
          pressed && !buttonDisabled ? styles.buttonPressed : null,
          buttonDisabled ? styles.buttonDisabled : null,
        ]}
      >
        <Text style={styles.buttonText}>
          {isSaving ? '保存中...' : 'ファイルに保存する'}
        </Text>
      </Pressable>

      {feedback && (
        <View
          style={[
            styles.feedback,
            feedback.type === 'success'
              ? styles.feedbackSuccess
              : styles.feedbackError,
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              feedback.type === 'success'
                ? styles.feedbackTextSuccess
                : styles.feedbackTextError,
            ]}
          >
            {feedback.message}
          </Text>
        </View>
      )}

      <Text
        style={[
          styles.tip,
          isDarkMode ? styles.lightText : styles.darkText,
        ]}
      >
        iOSではファイルアプリの「このiPhone内」→アプリ名のフォルダに保存されます。
        Androidでは「Download」フォルダに保存されます。
      </Text>
    </View>
  );
}

function buildFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `SavedText-${year}${month}${day}-${hours}${minutes}${seconds}.txt`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  lightBackground: {
    backgroundColor: '#ffffff',
  },
  darkBackground: {
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  textInput: {
    minHeight: 160,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
  },
  inputLight: {
    backgroundColor: '#f6f6f6',
    borderColor: '#d6d6d6',
    borderWidth: 1,
    color: '#111111',
  },
  inputDark: {
    backgroundColor: '#1f1f1f',
    borderColor: '#383838',
    borderWidth: 1,
    color: '#f7f7f7',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonLight: {
    backgroundColor: '#2563eb',
  },
  buttonDark: {
    backgroundColor: '#3b82f6',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  feedback: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  feedbackSuccess: {
    backgroundColor: '#ecfdf5',
  },
  feedbackError: {
    backgroundColor: '#fef2f2',
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 18,
  },
  feedbackTextSuccess: {
    color: '#166534',
  },
  feedbackTextError: {
    color: '#b91c1c',
  },
  tip: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 'auto',
  },
  darkText: {
    color: '#1c1c1c',
  },
  lightText: {
    color: '#f5f5f5',
  },
});

export default App;
