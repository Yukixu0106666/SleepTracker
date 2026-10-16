import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

export type AppLanguage = 'en' | 'zh';

const translations = {
  en: {
    tabHistory: 'Sleep History', tabSleep: 'Track Sleep', tabProfile: 'Profile', tabRecommendation: 'Recommendation', back: 'Back', localTime: 'Local time',
    settings: 'Settings', profilePhoto: 'Profile photo', upload: 'Upload', tapToUpload: 'Tap the circle to choose a photo',
    changePhoto: 'Change profile photo', uploadPhoto: 'Upload profile photo', takePhoto: 'Take Photo', delete: 'Delete',
    name: 'Name', age: 'Age', height: 'Height (cm)', weight: 'Weight (kg)', saveProfile: 'Save Profile', toggleTheme: 'Toggle Theme',
    language: 'Language', english: 'English', chinese: '中文', yourProfile: 'Your Profile:',
    validProfile: 'Please enter a valid name and numeric age.', profileSaved: 'Profile saved!', mediaPermission: 'Permission to access media library is required.', cameraPermission: 'Permission to access camera is required.',
    sleepJournal: 'SLEEP JOURNAL', restRecorded: 'Rest, recorded.', sleepInProgress: 'SLEEP IN PROGRESS', nextRest: 'NEXT REST', sleepWell: 'Sleep well.', ready: 'Ready when you are.',
    startedAt: 'STARTED AT', waiting: 'WAITING TO BEGIN', startSleep: 'Start sleep', stopSleep: 'Stop sleep', startTracking: 'Start sleep tracking', stopTracking: 'Stop sleep tracking',
    widgetNote: 'You can also start or stop from your Home Screen or Lock Screen.', timingTitle: 'A quick timing check', timingBody: 'This is outside the usual night sleep window after 9:00 PM and the 12:00-2:00 PM rest window. Irregular timing can make it harder to support your body\'s sleep rhythm.',
    goBack: 'Go back', startAnyway: 'Start anyway', finishSleep: 'Finish this sleep?', finishBody: "We'll save this session and prepare your daily support plan.", keepTracking: 'Keep tracking', stopAndSave: 'Stop & save', preparing: "Preparing today's supportive plan...", sleepSupport: "Today's Sleep Support", firstMeal: 'First meal', movement: 'Movement', mindset: 'Mindset', close: 'Close',
    morningReport: "Last Night's Sleep Report", predictedGood: 'Good sleep quality', predictedPoor: 'Low sleep quality', goodSleepLikelihood: "Last night's sleep score", whyThisEstimate: 'Why this score?', hideModelDetails: 'Hide scoring details', modelSignals: 'Scoring factors', durationSignal: 'Sleep duration', ageSignal: 'Age', bmiSignal: 'BMI category', positiveSignal: 'raised the score', negativeSignal: 'lowered the score', modelMethod: 'Sleep score calculated by a compact Logistic Regression using sleep duration, age, and BMI category.', modelValidation: 'Development validation: 0.960 macro-F1 with grouped 5-fold cross-validation.', modelDisclaimer: 'A portfolio sleep score based on public development data—not a medical assessment or a forecast of tonight.', predictedTrend: 'Sleep score trend', noPredictionTrend: 'Complete a sleep session to see sleep scores.',
    appName: 'Sleep Tracker', homeSubtitle: 'Track your sleep sessions and rest better.', viewHistory: 'View Sleep History', viewStats: 'View Stats', statsTitle: 'Sleep Statistics', appleHealth: 'Apple Health',
    noSleepData: 'No sleep data recorded.', session: 'Session', start: 'Start', end: 'End', duration: 'Duration', hours: 'hrs', deleteConfirmTitle: 'Ready to delete?', deleteConfirmBody: 'Do you want to delete this sleep session?', no: 'No', yes: 'Yes',
    weeklySleep: 'Your Sleep in the Past Week', averageSleep: 'Average Sleep', bestDay: 'Best Day', worstDay: 'Worst Day', enoughRest: "You're getting enough rest! Keep it up!", aimForSleep: 'Try to aim for 7–9 hours of sleep daily!', noStats: 'No sleep data to show yet.',
    recommendations: 'Sleep Recommendations', hello: 'Hello', preparingSupport: "Preparing today's support...", offlinePlan: 'AI recommendations are unavailable, so this is an offline support plan.', foodDrink: 'Food & drink', warmUp: 'Warm up', mainRoutine: 'Main routine', coolDown: 'Cool down', lowerEnergy: 'Lower-energy option', kinderMindset: 'A kinder mindset', tonight: 'Tonight', noRecommendations: 'Start and stop a sleep session to get suggestions tailored to your morning.', refreshAdvice: "Refresh today's advice", wellnessDisclaimer: 'These are general wellness suggestions, not medical advice.', minutes: 'minutes', min: 'min',
    tonightPrediction: "Tonight's Sleep Prediction", likelyGoodTonight: 'Good sleep is more likely', likelyPoorTonight: 'Good sleep may be less likely', tonightGoodLikelihood: 'Estimated chance of good sleep', recentGoodNights: 'Nights with 7–9 hours', averageRecentSleep: 'Average recent sleep', bedtimeVariation: 'Typical bedtime variation', dataConfidence: 'Data confidence', confidenceLow: 'Low', confidenceMedium: 'Medium', confidenceHigh: 'High', needMoreSleepData: 'Record at least 3 nights to unlock tonight’s prediction.', recordedNights: 'Nights recorded', tonightPredictionDisclaimer: 'Experimental estimate based only on recent sleep duration and bedtime consistency—not medical advice or a guarantee.',
    health: 'Health', healthSubtitle: 'Connect Apple Health to bring your recent sleep and heart-rate data into SleepTracker.', connectHealth: 'Connect Apple Health', refreshHealth: 'Refresh Apple Health', latestHeartRate: 'Latest heart rate', sleepLast24Hours: 'Sleep in last 24 hours', noData: 'No data', noRecentHeartRate: 'No recent heart-rate sample', sleepLastDay: 'Sleep records from the last 24 hours', noRecentSleep: 'No recent sleep records', healthConnectPrompt: 'Connect Apple Health to view sleep and heart-rate data.', healthIphoneOnly: 'Apple Health is available only in the SleepTracker app on iPhone.', healthRequesting: 'Requesting Apple Health access...', healthUnavailable: 'Apple Health is not available on this device.', healthReading: 'Reading your latest Apple Health data...', healthConnected: 'Connected to Apple Health.', healthReadError: 'Unable to read Apple Health data',
  },
  zh: {
    tabHistory: '睡眠记录', tabSleep: '记录睡眠', tabProfile: '个人资料', tabRecommendation: '睡眠建议', back: '返回', localTime: '本地时间',
    settings: '设置', profilePhoto: '个人头像', upload: '上传', tapToUpload: '点击圆圈选择照片',
    changePhoto: '更换个人头像', uploadPhoto: '上传个人头像', takePhoto: '拍照', delete: '删除',
    name: '姓名', age: '年龄', height: '身高（厘米）', weight: '体重（千克）', saveProfile: '保存资料', toggleTheme: '切换主题',
    language: '语言', english: 'English', chinese: '中文', yourProfile: '你的资料：',
    validProfile: '请输入有效的姓名和数字年龄。', profileSaved: '资料已保存！', mediaPermission: '需要照片库访问权限。', cameraPermission: '需要相机访问权限。',
    sleepJournal: '睡眠日志', restRecorded: '记录每一次休息。', sleepInProgress: '正在睡眠', nextRest: '下一次休息', sleepWell: '好好休息。', ready: '准备好了就开始吧。',
    startedAt: '开始时间', waiting: '等待开始', startSleep: '开始睡眠', stopSleep: '结束睡眠', startTracking: '开始记录睡眠', stopTracking: '结束记录睡眠',
    widgetNote: '你也可以从主屏幕或锁定屏幕开始或结束记录。', timingTitle: '睡眠时间提醒', timingBody: '当前不在通常的睡眠时间（晚上 9 点后）或午休时间（中午 12 点至下午 2 点）。不规律的睡眠时间可能更难维持身体的睡眠节律。',
    goBack: '返回', startAnyway: '仍要开始', finishSleep: '结束本次睡眠？', finishBody: '我们会保存这次记录，并准备你的每日支持计划。', keepTracking: '继续记录', stopAndSave: '结束并保存', preparing: '正在准备今天的支持计划...', sleepSupport: '今日睡眠建议', firstMeal: '第一餐', movement: '运动', mindset: '心态', close: '关闭',
    morningReport: '昨晚睡眠报告', predictedGood: '昨晚睡眠质量良好', predictedPoor: '昨晚睡眠质量偏低', goodSleepLikelihood: '昨晚睡眠评分', whyThisEstimate: '为什么是这个评分？', hideModelDetails: '收起评分说明', modelSignals: '评分因素', durationSignal: '睡眠时长', ageSignal: '年龄', bmiSignal: 'BMI 分类', positiveSignal: '提高了评分', negativeSignal: '降低了评分', modelMethod: '睡眠评分由精简 Logistic Regression 根据睡眠时长、年龄和 BMI 分类计算。', modelValidation: '开发集验证：grouped 5-fold 交叉验证 macro-F1 为 0.960。', modelDisclaimer: '这是基于公开开发数据的作品集睡眠评分，不是医疗评估，也不是对今晚的预测。', predictedTrend: '睡眠评分趋势', noPredictionTrend: '完成一次睡眠记录后即可查看睡眠评分。',
    appName: '睡眠记录', homeSubtitle: '记录睡眠时段，睡得更好。', viewHistory: '查看睡眠记录', viewStats: '查看统计', statsTitle: '睡眠统计', appleHealth: 'Apple 健康',
    noSleepData: '暂无睡眠记录。', session: '第', start: '开始', end: '结束', duration: '时长', hours: '小时', deleteConfirmTitle: '确认删除？', deleteConfirmBody: '要删除这条睡眠记录吗？', no: '否', yes: '是',
    weeklySleep: '过去一周的睡眠', averageSleep: '平均睡眠', bestDay: '睡眠最佳的一天', worstDay: '睡眠最少的一天', enoughRest: '你的休息时间充足，继续保持！', aimForSleep: '建议每天睡眠 7–9 小时！', noStats: '暂时没有可显示的睡眠统计。',
    recommendations: '睡眠建议', hello: '你好', preparingSupport: '正在准备今天的建议...', offlinePlan: 'AI 建议暂不可用，以下为离线支持计划。', foodDrink: '饮食与饮水', warmUp: '热身', mainRoutine: '主要训练', coolDown: '放松', lowerEnergy: '低精力备选方案', kinderMindset: '温和的心态', tonight: '今晚', noRecommendations: '开始并结束一次睡眠记录后，即可获得适合你早晨状态的建议。', refreshAdvice: '刷新今日建议', wellnessDisclaimer: '这些是一般健康建议，不能替代医疗建议。', minutes: '分钟', min: '分钟',
    tonightPrediction: '今晚睡眠预测', likelyGoodTonight: '今晚较可能睡好', likelyPoorTonight: '今晚睡好可能性偏低', tonightGoodLikelihood: '预计睡好概率', recentGoodNights: '睡眠 7–9 小时的晚数', averageRecentSleep: '近期平均睡眠', bedtimeVariation: '通常入睡时间波动', dataConfidence: '数据置信度', confidenceLow: '较低', confidenceMedium: '中等', confidenceHigh: '较高', needMoreSleepData: '记录至少 3 晚后即可查看今晚睡眠预测。', recordedNights: '已记录晚数', tonightPredictionDisclaimer: '这是仅依据近期睡眠时长和入睡规律生成的实验性估计，不是医疗建议，也不能保证今晚的结果。',
    health: '健康', healthSubtitle: '连接 Apple 健康，将最近的睡眠和心率数据导入 SleepTracker。', connectHealth: '连接 Apple 健康', refreshHealth: '刷新 Apple 健康', latestHeartRate: '最新心率', sleepLast24Hours: '过去 24 小时睡眠', noData: '暂无数据', noRecentHeartRate: '暂无近期心率记录', sleepLastDay: '过去 24 小时的睡眠记录', noRecentSleep: '暂无近期睡眠记录', healthConnectPrompt: '连接 Apple 健康以查看睡眠和心率数据。', healthIphoneOnly: 'Apple 健康仅可在 iPhone 上的 SleepTracker 中使用。', healthRequesting: '正在请求 Apple 健康访问权限...', healthUnavailable: '此设备无法使用 Apple 健康。', healthReading: '正在读取最新 Apple 健康数据...', healthConnected: '已连接 Apple 健康。', healthReadError: '无法读取 Apple 健康数据',
  },
} as const;

type TranslationKey = keyof typeof translations.en;

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => undefined,
  t: (key) => translations.en[key],
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setCurrentLanguage] = useState<AppLanguage>('en');

  useEffect(() => {
    AsyncStorage.getItem('appLanguage').then((storedLanguage) => {
      if (storedLanguage === 'en' || storedLanguage === 'zh') setCurrentLanguage(storedLanguage);
    }).catch(() => undefined);
  }, []);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setCurrentLanguage(nextLanguage);
    AsyncStorage.setItem('appLanguage', nextLanguage).catch(() => undefined);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: (key) => translations[language][key] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
