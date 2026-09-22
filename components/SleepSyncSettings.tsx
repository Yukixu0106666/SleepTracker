import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { connectSleepSync, disconnectSleepSync, flushSleepUploads, getSleepSyncStatus } from '../services/sleepSync';
import { useLanguage } from '../theme/LanguageContext';
import { useThemeContext } from '../theme/ThemeContext';

export function SleepSyncSettings() {
  const { language } = useLanguage();
  const { theme } = useThemeContext();
  const zh = language === 'zh';
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getSleepSyncStatus>>>();
  const color = theme === 'dark' ? '#F1F5F9' : '#183647';
  useEffect(() => {
    let active = true;
    const refresh = () => getSleepSyncStatus().then(value => { if (active) setStatus(value); }).catch(() => { if (active) setError('storage'); });
    void refresh();
    const timer = setInterval(refresh, 2000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      setToken('');
      setStatus(await getSleepSyncStatus());
    } catch (err) { setError(err instanceof Error ? err.message : 'connection'); }
    finally { setBusy(false); }
  }
  const button = (label: string, action: () => Promise<void>, disabled = false) => (
    <Pressable accessibilityRole="button" disabled={busy || disabled} onPress={() => void act(action)}
      style={{ backgroundColor: '#176C89', opacity: busy || disabled ? 0.5 : 1, borderRadius: 8, padding: 12, marginTop: 10 }}>
      <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ width: '100%', borderTopWidth: 1, borderTopColor: '#8A9BA5', paddingTop: 20, marginTop: 24 }}>
      <Text style={{ color, fontSize: 19, fontWeight: '600', marginBottom: 10 }}>{zh ? '云端上传' : 'Cloud upload'}</Text>
      <Text style={{ color, lineHeight: 22 }}>
        {zh ? '连接后，会上传此设备已有和新增的睡眠记录及删除操作。仅包含睡眠时间和时区。断网时保留记录，回到 App 后自动重试。' : 'Connecting uploads existing and new sleep records and deletions from this device, including sleep times and time zone. Offline changes are kept and retried while the app is open.'}
      </Text>
      {Platform.OS === 'web' && <Text style={{ color, marginTop: 8 }}>{zh ? '网页版关闭标签页后，需要重新输入连接凭证。' : 'On web, enter your credential again after closing the tab.'}</Text>}
      {!status?.configured && <Text style={{ color, marginTop: 10 }}>{zh ? '当前版本尚未配置云端服务地址。记录仍保存在本机。' : 'A cloud service address has not been configured for this build. Records remain on this device.'}</Text>}
      <Text accessibilityLiveRegion="polite" style={{ color, marginTop: 10 }}>
        {status?.connected ? (zh ? '已连接' : 'Connected') : (zh ? '未连接' : 'Disconnected')}
        {status && ` · ${zh ? '待上传' : 'Pending'} ${status.pending}`}
      </Text>
      {status?.lastSyncedAt && <Text style={{ color, marginTop: 6 }}>{zh ? '最近上传：' : 'Last upload: '}{new Date(status.lastSyncedAt).toLocaleString()}</Text>}
      {!!status?.error && <Text style={{ color, marginTop: 8 }}>
        {status.blocked
          ? (zh ? '部分记录未获服务器确认。请检查连接凭证或联系服务管理员，然后重试。记录仍保存在本机。' : 'Some records were not accepted. Check your credential or contact the service administrator, then retry. Local records are kept.')
          : (zh ? '上传暂未完成，将自动重试。' : 'Upload is incomplete and will retry automatically.')}
      </Text>}
      {(!status?.connected || Boolean(status?.blocked)) && <>
        <TextInput value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false}
          accessibilityLabel={zh ? '个人连接凭证' : 'Personal connection credential'}
          placeholder={zh ? '输入个人连接凭证' : 'Personal connection credential'} placeholderTextColor="#8A9BA5"
          style={{ color, borderColor: '#8A9BA5', borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 12 }} />
        {button(zh ? '连接并上传睡眠记录' : 'Connect and upload sleep records', () => connectSleepSync(token), !token || !status?.configured)}
      </>}
      {status?.connected && <>
        {button(zh ? '立即重试' : 'Retry now', () => flushSleepUploads(true))}
        {button(zh ? '断开连接' : 'Disconnect', disconnectSleepSync)}
      </>}
      {busy && <ActivityIndicator style={{ marginTop: 10 }} />}
      {!!error && <Text accessibilityLiveRegion="polite" style={{ color, marginTop: 10 }}>
        {error.includes('another account')
          ? (zh ? '此设备的记录已绑定其他账户或服务。请使用原账户的连接凭证。' : 'This history is linked to another account or server. Use the original account credential.')
          : (zh ? '操作未完成，请检查服务地址、网络和连接凭证。' : 'Unable to complete the operation. Check the service address, network and credential.')}
      </Text>}
    </View>
  );
}
